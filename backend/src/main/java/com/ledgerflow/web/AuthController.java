package com.ledgerflow.web;

import com.ledgerflow.auth.AuthService;
import com.ledgerflow.auth.PasswordResetService;
import com.ledgerflow.security.CurrentUserService;
import com.ledgerflow.security.SessionCookieService;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import org.springframework.http.HttpStatus;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    private final AuthService auth;
    private final PasswordResetService resets;
    private final CurrentUserService currentUser;
    private final SessionCookieService cookies;

    public AuthController(AuthService auth, PasswordResetService resets, CurrentUserService currentUser,
                          SessionCookieService cookies) {
        this.auth = auth; this.resets = resets; this.currentUser = currentUser; this.cookies = cookies;
    }

    public record RegisterRequest(@NotBlank String name, @NotBlank @Email String email,
                                  @NotBlank String password) {}
    public record LoginRequest(@NotBlank @Email String email, @NotBlank String password) {}
    public record ForgotRequest(@NotBlank @Email String email) {}
    public record ResetRequest(@NotBlank String token, @NotBlank String password) {}
    public record Message(String message) {}
    public record Csrf(String cookieName, String headerName) {}

    @GetMapping("/csrf")
    ApiEnvelope<Csrf> csrf(CsrfToken token) {
        return ApiEnvelope.of(new Csrf("XSRF-TOKEN", token.getHeaderName()));
    }

    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    ApiEnvelope<AuthService.SafeUser> register(@Valid @RequestBody RegisterRequest request) {
        return ApiEnvelope.of(auth.register(request.name(), request.email(), request.password()));
    }

    @PostMapping("/login")
    ApiEnvelope<AuthService.SafeUser> login(@Valid @RequestBody LoginRequest request,
                                             HttpServletResponse response) {
        var result = auth.login(request.email(), request.password());
        cookies.set(response, result.rawToken());
        return ApiEnvelope.of(result.user());
    }

    @PostMapping("/logout")
    ApiEnvelope<Message> logout(HttpServletResponse response) {
        var user = currentUser.require();
        auth.logout(user.userId(), user.sessionId());
        cookies.clear(response);
        return ApiEnvelope.of(new Message("Signed out."));
    }

    @PostMapping("/refresh")
    ApiEnvelope<Message> refresh(HttpServletResponse response) {
        var user = currentUser.require();
        cookies.set(response, auth.rotate(user.sessionId()));
        return ApiEnvelope.of(new Message("Session refreshed."));
    }

    @PostMapping("/forgot-password")
    ApiEnvelope<Message> forgot(@Valid @RequestBody ForgotRequest request) {
        resets.request(request.email());
        return ApiEnvelope.of(new Message("If the account exists, password reset instructions have been sent."));
    }

    @PostMapping("/reset-password")
    ApiEnvelope<Message> reset(@Valid @RequestBody ResetRequest request) {
        resets.reset(request.token(), request.password());
        return ApiEnvelope.of(new Message("Password reset successful."));
    }
}
