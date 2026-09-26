#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use rand::{distr::Alphanumeric, Rng};
use std::{
    fs::{self, OpenOptions},
    io::{Read, Write},
    net::{IpAddr, Ipv4Addr, SocketAddr, TcpListener, TcpStream},
    path::{Path, PathBuf},
    process::{Child, Command, Stdio},
    sync::{
        atomic::{AtomicBool, Ordering},
        Mutex,
    },
    thread,
    time::{Duration, Instant},
};
use tauri::{path::BaseDirectory, Manager, RunEvent};

#[cfg(windows)]
use std::os::windows::process::CommandExt;

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x08000000;

#[derive(Default)]
struct BackendInner {
    child: Option<Child>,
    port: Option<u16>,
    shutdown_token: Option<String>,
}

#[derive(Default)]
struct BackendState {
    inner: Mutex<BackendInner>,
    stopping: AtomicBool,
}

fn main() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _, _| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
        }))
        .setup(|app| {
            app.manage(BackendState::default());
            let handle = app.handle().clone();
            thread::Builder::new()
                .name("ledgerflow-backend-startup".into())
                .spawn(move || start_desktop_backend(handle))
                .map_err(|error| error.to_string())?;
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("could not build LedgerFlow desktop application");

    app.run(|handle, event| {
        if matches!(event, RunEvent::ExitRequested { .. } | RunEvent::Exit) {
            shutdown_backend(handle);
        }
    });
}

fn start_desktop_backend(app: tauri::AppHandle) {
    let result = launch_and_wait(&app);
    match result {
        Ok(port) => {
            let url = format!("http://127.0.0.1:{port}/");
            if let Some(window) = app.get_webview_window("main") {
                match url.parse::<tauri::Url>() {
                    Ok(url) => {
                        if let Err(error) = window.navigate(url) {
                            startup_failed(&app, "The LedgerFlow window could not open.", &error.to_string());
                            return;
                        }
                        let _ = window.set_title("LedgerFlow");
                    }
                    Err(error) => {
                        startup_failed(&app, "The local LedgerFlow address was invalid.", &error.to_string());
                        return;
                    }
                }
            }
            monitor_backend(app);
        }
        Err(error) => startup_failed(
            &app,
            "LedgerFlow could not start its local service. Close the app and try again.",
            &error,
        ),
    }
}

fn launch_and_wait(app: &tauri::AppHandle) -> Result<u16, String> {
    let local_root = match std::env::var_os("LEDGERFLOW_DESKTOP_TEST_DATA_ROOT") {
        Some(path) if !path.is_empty() => PathBuf::from(path),
        _ => app
            .path()
            .app_local_data_dir()
            .map_err(|error| format!("application-data directory: {error}"))?,
    };
    let data_dir = local_root.join("data");
    let log_dir = local_root.join("logs");
    fs::create_dir_all(&data_dir).map_err(|error| format!("create application-data directory: {error}"))?;
    fs::create_dir_all(&log_dir).map_err(|error| format!("create log directory: {error}"))?;

    let java = app
        .path()
        .resolve("runtime/bin/javaw.exe", BaseDirectory::Resource)
        .map_err(|error| format!("resolve bundled Java runtime: {error}"))?;
    let backend = app
        .path()
        .resolve("backend/ledgerflow-backend.jar", BaseDirectory::Resource)
        .map_err(|error| format!("resolve bundled backend: {error}"))?;
    require_file(&java, "bundled Java runtime")?;
    require_file(&backend, "bundled backend")?;

    for attempt in 1..=3 {
        if app.state::<BackendState>().stopping.load(Ordering::SeqCst) {
            return Err("application closed during startup".into());
        }
        let port = free_loopback_port()?;
        let token: String = rand::rng()
            .sample_iter(&Alphanumeric)
            .take(48)
            .map(char::from)
            .collect();
        let process_log = open_append(log_dir.join("backend-process.log"))?;
        let process_error = process_log
            .try_clone()
            .map_err(|error| format!("clone backend log handle: {error}"))?;

        let mut command = Command::new(&java);
        command
            .arg(format!("-Dserver.port={port}"))
            .arg("-Dserver.address=127.0.0.1")
            .arg("-Dspring.profiles.active=desktop")
            .arg(format!("-Dledgerflow.data-dir={}", data_dir.display()))
            .arg(format!("-Dledgerflow.desktop.shutdown-token={token}"))
            .arg(format!("-Dlogging.file.name={}", log_dir.join("backend.log").display()))
            .arg("-jar")
            .arg(&backend)
            .current_dir(&local_root)
            .stdin(Stdio::null())
            .stdout(Stdio::from(process_log))
            .stderr(Stdio::from(process_error));
        #[cfg(windows)]
        command.creation_flags(CREATE_NO_WINDOW);
        let child = command
            .spawn()
            .map_err(|error| format!("launch bundled backend: {error}"))?;
        {
            let state = app.state::<BackendState>();
            let mut inner = state.inner.lock().map_err(|_| "backend process lock was poisoned")?;
            inner.child = Some(child);
            inner.port = Some(port);
            inner.shutdown_token = Some(token);
        }

        match wait_for_health(app, port, Duration::from_secs(45)) {
            Ok(()) => {
                append_log(&log_dir, &format!("backend ready on loopback port {port}"));
                return Ok(port);
            }
            Err(error) => {
                append_log(&log_dir, &format!("backend startup attempt {attempt} failed: {error}"));
                terminate_child(app);
                if attempt == 3 {
                    return Err(error);
                }
            }
        }
    }
    Err("backend did not become ready".into())
}

fn require_file(path: &Path, description: &str) -> Result<(), String> {
    if path.is_file() {
        Ok(())
    } else {
        Err(format!("{description} is missing"))
    }
}

fn free_loopback_port() -> Result<u16, String> {
    let listener = TcpListener::bind((Ipv4Addr::LOCALHOST, 0))
        .map_err(|error| format!("select loopback port: {error}"))?;
    listener
        .local_addr()
        .map(|address| address.port())
        .map_err(|error| format!("read loopback port: {error}"))
}

fn wait_for_health(app: &tauri::AppHandle, port: u16, timeout: Duration) -> Result<(), String> {
    let started = Instant::now();
    while started.elapsed() < timeout {
        if app.state::<BackendState>().stopping.load(Ordering::SeqCst) {
            return Err("application closed during startup".into());
        }
        {
            let state = app.state::<BackendState>();
            let mut inner = state.inner.lock().map_err(|_| "backend process lock was poisoned")?;
            if let Some(child) = inner.child.as_mut() {
                if let Some(status) = child.try_wait().map_err(|error| format!("check backend process: {error}"))? {
                    return Err(format!("backend exited before readiness ({status})"));
                }
            }
        }
        if health_is_up(port) {
            return Ok(());
        }
        thread::sleep(Duration::from_millis(150));
    }
    Err("backend readiness timed out".into())
}

fn health_is_up(port: u16) -> bool {
    let address = SocketAddr::new(IpAddr::V4(Ipv4Addr::LOCALHOST), port);
    let Ok(mut stream) = TcpStream::connect_timeout(&address, Duration::from_millis(300)) else {
        return false;
    };
    let _ = stream.set_read_timeout(Some(Duration::from_millis(500)));
    let _ = stream.set_write_timeout(Some(Duration::from_millis(500)));
    if stream
        .write_all(b"GET /api/health HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n")
        .is_err()
    {
        return false;
    }
    let mut response = String::new();
    stream.read_to_string(&mut response).is_ok()
        && response.starts_with("HTTP/1.1 200")
        && response.contains("\"status\":\"UP\"")
}

fn monitor_backend(app: tauri::AppHandle) {
    thread::Builder::new()
        .name("ledgerflow-backend-monitor".into())
        .spawn(move || loop {
            thread::sleep(Duration::from_secs(1));
            let exited = {
                let state = app.state::<BackendState>();
                let Ok(mut inner) = state.inner.lock() else { return };
                match inner.child.as_mut().and_then(|child| child.try_wait().ok()).flatten() {
                    Some(status) => {
                        inner.child = None;
                        Some(status.to_string())
                    }
                    None => None,
                }
            };
            if let Some(status) = exited {
                if !app.state::<BackendState>().stopping.load(Ordering::SeqCst) {
                    if let Ok(root) = app.path().app_local_data_dir() {
                        append_log(&root.join("logs"), &format!("backend exited unexpectedly: {status}"));
                    }
                    backend_crashed(&app);
                }
                return;
            }
        })
        .ok();
}

fn backend_crashed(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.eval(r#"document.title='LedgerFlow - Service unavailable';document.body.innerHTML='<main style="font-family:Segoe UI,sans-serif;max-width:560px;margin:12vh auto;padding:36px;color:#0f172a"><h1>LedgerFlow service stopped</h1><p style="line-height:1.6;color:#475569">Your data remains on this computer. Close LedgerFlow and open it again. Details were written to the application log.</p></main>'"#);
    }
}

fn startup_failed(app: &tauri::AppHandle, user_message: &str, detail: &str) {
    if let Ok(root) = app.path().app_local_data_dir() {
        append_log(&root.join("logs"), &format!("startup failed: {detail}"));
    }
    if let Some(window) = app.get_webview_window("main") {
        let script = format!(
            "document.title='LedgerFlow - Startup failed';document.body.innerHTML='<main style=\"font-family:Segoe UI,sans-serif;max-width:560px;margin:12vh auto;padding:36px;color:#0f172a\"><h1>LedgerFlow could not start</h1><p style=\"line-height:1.6;color:#475569\">{}</p><p style=\"line-height:1.6;color:#64748b\">Diagnostic details were written to the LedgerFlow application logs.</p></main>'",
            user_message
        );
        let _ = window.eval(script);
    }
}

fn shutdown_backend(app: &tauri::AppHandle) {
    let state = app.state::<BackendState>();
    if state.stopping.swap(true, Ordering::SeqCst) {
        return;
    }
    let (port, token) = {
        let Ok(inner) = state.inner.lock() else { return };
        (inner.port, inner.shutdown_token.clone())
    };
    if let (Some(port), Some(token)) = (port, token) {
        request_graceful_shutdown(port, &token);
    }
    let deadline = Instant::now() + Duration::from_secs(6);
    while Instant::now() < deadline {
        let exited = {
            let Ok(mut inner) = state.inner.lock() else { return };
            match inner.child.as_mut() {
                Some(child) => child.try_wait().ok().flatten().is_some(),
                None => true,
            }
        };
        if exited {
            if let Ok(mut inner) = state.inner.lock() {
                inner.child = None;
            }
            return;
        }
        thread::sleep(Duration::from_millis(100));
    }
    terminate_child(app);
}

fn request_graceful_shutdown(port: u16, token: &str) {
    let address = SocketAddr::new(IpAddr::V4(Ipv4Addr::LOCALHOST), port);
    if let Ok(mut stream) = TcpStream::connect_timeout(&address, Duration::from_millis(500)) {
        let _ = stream.set_write_timeout(Some(Duration::from_millis(500)));
        let request = format!(
            "POST /api/desktop/shutdown HTTP/1.1\r\nHost: 127.0.0.1\r\nX-LedgerFlow-Shutdown: {token}\r\nContent-Length: 0\r\nConnection: close\r\n\r\n"
        );
        let _ = stream.write_all(request.as_bytes());
    }
}

fn terminate_child(app: &tauri::AppHandle) {
    let state = app.state::<BackendState>();
    let lock = state.inner.lock();
    if let Ok(mut inner) = lock {
        if let Some(mut child) = inner.child.take() {
            let _ = child.kill();
            let _ = child.wait();
        }
        inner.port = None;
        inner.shutdown_token = None;
    }
}

fn open_append(path: PathBuf) -> Result<std::fs::File, String> {
    OpenOptions::new()
        .create(true)
        .append(true)
        .open(path)
        .map_err(|error| format!("open backend process log: {error}"))
}

fn append_log(directory: &Path, message: &str) {
    if fs::create_dir_all(directory).is_err() {
        return;
    }
    if let Ok(mut file) = OpenOptions::new()
        .create(true)
        .append(true)
        .open(directory.join("desktop-supervisor.log"))
    {
        let _ = writeln!(file, "{message}");
    }
}
