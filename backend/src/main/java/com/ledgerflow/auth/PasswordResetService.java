package com.ledgerflow.auth;

import java.time.Instant;

import com.ledgerflow.security.LedgerFlowSecurityProperties;
import com.ledgerflow.security.TokenService;
import com.ledgerflow.web.ApiException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PasswordResetService {
    private static final Logger log = LoggerFactory.getLogger(PasswordResetService.class);
    private final UserRepository users;
    private final PasswordResetTokenRepository resetTokens;
    private final AuthSessionRepository sessions;
    private final PasswordResetNotifier notifier;
    private final PasswordEncoder passwords;
    private final PasswordPolicy policy;
    private final TokenService tokens;
    private final SecurityAuditRepository audit;
    private final LedgerFlowSecurityProperties properties;

    public PasswordResetService(UserRepository users, PasswordResetTokenRepository resetTokens,
                                AuthSessionRepository sessions, PasswordResetNotifier notifier,
                                PasswordEncoder passwords, PasswordPolicy policy, TokenService tokens,
                                SecurityAuditRepository audit, LedgerFlowSecurityProperties properties) {
        this.users = users; this.resetTokens = resetTokens; this.sessions = sessions; this.notifier = notifier;
        this.passwords = passwords; this.policy = policy; this.tokens = tokens; this.audit = audit;
        this.properties = properties;
    }

    @Transactional
    public void request(String email) {
        users.findByNormalizedEmail(UserRepository.normalizeEmail(email)).ifPresent(user -> {
            String raw = tokens.generate();
            resetTokens.create(user.id(), tokens.hash(raw), Instant.now().plus(properties.getResetTokenTtl()));
            try {
                notifier.sendPasswordReset(user, raw);
            } catch (RuntimeException exception) {
                // Keep the public response identical for known and unknown accounts.
                log.error("Password reset notification failed for user id {}", user.id());
            }
        });
    }

    @Transactional
    public void reset(String rawToken, String newPassword) {
        policy.validate(newPassword);
        var token = resetTokens.findByHash(tokens.hash(rawToken)).orElseThrow(() ->
                new ApiException(HttpStatus.BAD_REQUEST, "AUTH_RESET_TOKEN_INVALID",
                        "The password reset token is invalid."));
        if (token.usedAt() != null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "AUTH_RESET_TOKEN_INVALID",
                    "The password reset token is invalid.");
        }
        if (!token.expiresAt().isAfter(Instant.now())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "AUTH_RESET_TOKEN_EXPIRED",
                    "The password reset token has expired.");
        }
        if (resetTokens.markUsedIfUnused(token.id()) != 1) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "AUTH_RESET_TOKEN_INVALID",
                    "The password reset token is invalid.");
        }
        users.updatePassword(token.userId(), passwords.encode(newPassword));
        sessions.revokeAllForUser(token.userId());
        audit.record(token.userId(), "AUTH_PASSWORD_RESET");
    }
}
