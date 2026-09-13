package com.ledgerflow.attachment;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.file.AtomicMoveNotSupportedException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.nio.file.StandardOpenOption;
import java.util.UUID;

import com.ledgerflow.config.LedgerFlowDataProperties;
import com.ledgerflow.web.ApiException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

@Component
public class FileSystemAttachmentStorage implements AttachmentStorage {
    private static final Logger log = LoggerFactory.getLogger(FileSystemAttachmentStorage.class);
    private final Path root;
    private final Path temporaryRoot;

    public FileSystemAttachmentStorage(LedgerFlowDataProperties properties) {
        if (properties.getDataDir() == null || properties.getDataDir().isBlank()) {
            throw new IllegalArgumentException("ledgerflow.data-dir must not be blank");
        }
        try {
            root = Path.of(properties.getDataDir()).toAbsolutePath().normalize().resolve("attachments");
            temporaryRoot = root.resolve(".tmp");
            Files.createDirectories(temporaryRoot);
            ensureInsideRoot(temporaryRoot.toRealPath());
        } catch (IOException exception) {
            throw new IllegalStateException("Could not initialize the LedgerFlow attachment directory.", exception);
        }
    }

    @Override
    public StoredFile store(long companyId, long transactionId, String extension,
                            InputStream inputStream, long maxBytes) {
        String fileName = UUID.randomUUID() + "." + extension;
        String storageKey = "companies/" + companyId + "/transactions/" + transactionId + "/" + fileName;
        Path temporary = null;
        try {
            Files.createDirectories(temporaryRoot);
            ensureInsideRoot(temporaryRoot.toRealPath());
            temporary = Files.createTempFile(temporaryRoot, "upload-", ".tmp");
            long written = copyBounded(inputStream, temporary, maxBytes);
            Path destination = resolveForWrite(storageKey);
            Files.createDirectories(destination.getParent());
            ensureInsideRoot(destination.getParent().toRealPath());
            try {
                Files.move(temporary, destination, StandardCopyOption.ATOMIC_MOVE);
            } catch (AtomicMoveNotSupportedException exception) {
                Files.move(temporary, destination);
            }
            return new StoredFile(storageKey, written);
        } catch (ApiException exception) {
            deleteQuietly(temporary);
            throw exception;
        } catch (IOException exception) {
            deleteQuietly(temporary);
            throw storageFailure("The attachment could not be stored.", exception);
        }
    }

    @Override
    public LoadedFile load(String storageKey) {
        Path path = resolveExisting(storageKey);
        try {
            if (!Files.isRegularFile(path)) throw missingFile();
            return new LoadedFile(Files.newInputStream(path, StandardOpenOption.READ), Files.size(path));
        } catch (ApiException exception) {
            throw exception;
        } catch (IOException exception) {
            log.warn("Attachment file is unavailable for storage key hash {}", Integer.toHexString(storageKey.hashCode()));
            throw missingFile();
        }
    }

    @Override
    public boolean delete(String storageKey) {
        Path path;
        try {
            path = resolveExisting(storageKey);
        } catch (ApiException exception) {
            return false;
        }
        try {
            boolean deleted = Files.deleteIfExists(path);
            removeEmptyParents(path.getParent());
            return deleted;
        } catch (IOException exception) {
            log.warn("Could not remove attachment file for storage key hash {}",
                    Integer.toHexString(storageKey.hashCode()), exception);
            return false;
        }
    }

    @Override
    public boolean exists(String storageKey) {
        try { return Files.isRegularFile(resolveExisting(storageKey)); }
        catch (ApiException exception) { return false; }
    }

    Path rootForTests() { return root; }

    private long copyBounded(InputStream input, Path temporary, long maxBytes) throws IOException {
        byte[] buffer = new byte[8192];
        long total = 0;
        try (input; OutputStream output = Files.newOutputStream(temporary, StandardOpenOption.WRITE)) {
            int read;
            while ((read = input.read(buffer)) != -1) {
                total = Math.addExact(total, read);
                if (total > maxBytes) {
                    throw new ApiException(HttpStatus.PAYLOAD_TOO_LARGE, "ATTACHMENT_TOO_LARGE",
                            "The attachment exceeds the configured size limit.");
                }
                output.write(buffer, 0, read);
            }
        }
        if (total == 0) {
            throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "ATTACHMENT_CONTENT_INVALID",
                    "The attachment is empty.");
        }
        return total;
    }

    private Path resolveForWrite(String storageKey) {
        Path relative = relative(storageKey);
        Path resolved = root.resolve(relative).normalize();
        ensureInsideRoot(resolved);
        return resolved;
    }

    private Path resolveExisting(String storageKey) {
        Path path = resolveForWrite(storageKey);
        if (!Files.exists(path)) throw missingFile();
        try {
            Path real = path.toRealPath();
            ensureInsideRoot(real);
            return real;
        } catch (IOException exception) {
            throw missingFile();
        }
    }

    private Path relative(String storageKey) {
        if (storageKey == null || storageKey.isBlank() || storageKey.indexOf('\0') >= 0) throw invalidKey();
        Path relative;
        try { relative = Path.of(storageKey.replace('/', java.io.File.separatorChar)).normalize(); }
        catch (RuntimeException exception) { throw invalidKey(); }
        if (relative.isAbsolute() || relative.startsWith("..")) throw invalidKey();
        return relative;
    }

    private void ensureInsideRoot(Path path) {
        if (!path.toAbsolutePath().normalize().startsWith(root)) throw invalidKey();
    }

    private void removeEmptyParents(Path directory) {
        Path current = directory;
        while (current != null && !current.equals(root) && !current.equals(temporaryRoot)) {
            try {
                Files.delete(current);
                current = current.getParent();
            } catch (IOException exception) {
                return;
            }
        }
    }

    private void deleteQuietly(Path path) {
        if (path == null) return;
        try { Files.deleteIfExists(path); }
        catch (IOException exception) { log.warn("Could not remove a staged attachment file."); }
    }

    private ApiException invalidKey() {
        return new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "ATTACHMENT_STORAGE_FAILED",
                "The stored attachment location is invalid.");
    }

    private ApiException missingFile() {
        return new ApiException(HttpStatus.CONFLICT, "ATTACHMENT_FILE_MISSING",
                "The attachment metadata exists, but the stored file is unavailable.");
    }

    private ApiException storageFailure(String message, Exception exception) {
        log.error("Attachment storage operation failed.", exception);
        return new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "ATTACHMENT_STORAGE_FAILED", message);
    }
}
