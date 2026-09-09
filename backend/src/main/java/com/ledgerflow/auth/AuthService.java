package com.ledgerflow.auth;

import java.time.Instant;

import com.ledgerflow.security.LedgerFlowSecurityProperties;
import com.ledgerflow.security.TokenService;
import com.ledgerflow.web.ApiException;
import org.springframework.dao.DataAccessException;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {
    private final UserRepository users;
    private final AuthSessionRepository sessions;
    private final SecurityAuditRepository audit;
    private final PasswordEncoder passwords;
    private final PasswordPolicy policy;
    private final TokenService tokens;
    private final LedgerFlowSecurityProperties properties;
    private final String dummyPasswordHash;

    public AuthService(UserRepository users, AuthSessionRepository sessions, SecurityAuditRepository audit,
                       PasswordEncoder passwords, PasswordPolicy policy, TokenService tokens,
                       LedgerFlowSecurityProperties properties) {
        this.users = users; this.sessions = sessions; this.audit = audit; this.passwords = passwords;
        this.policy = policy; this.tokens = tokens; this.properties = properties;
        this.dummyPasswordHash = passwords.encode("ledgerflow-dummy-password");
    }

    public record SafeUser(long id, String name, String email) {
        static SafeUser from(UserAccount user) { return new SafeUser(user.id(), user.name(), user.email()); }
    }
    public record LoginResult(SafeUser user, String rawToken) {}

    @Transactional
    public SafeUser register(String name, String email, String password) {
        policy.validate(password);
        String cleanName = name.strip();
        String cleanEmail = email.strip();
        String normalizedEmail = UserRepository.normalizeEmail(cleanEmail);
        if (users.findByNormalizedEmail(normalizedEmail).isPresent()) {
            throw duplicateEmail();
        }
        try {
            UserAccount user = users.create(cleanName, cleanEmail, passwords.encode(password));
            audit.record(user.id(), "AUTH_REGISTERED");
            return SafeUser.from(user);
        } catch (DataAccessException exception) {
            if (users.findByNormalizedEmail(normalizedEmail).isPresent()) throw duplicateEmail();
            throw exception;
        }
    }

    private ApiException duplicateEmail() {
        return new ApiException(HttpStatus.CONFLICT, "EMAIL_ALREADY_REGISTERED",
                "An account with this email already exists.");
    }

    @Transactional
    public LoginResult login(String email, String password) {
        var found = users.findByNormalizedEmail(UserRepository.normalizeEmail(email));
        String hash = found.map(UserAccount::passwordHash).orElse(dummyPasswordHash);
        if (!passwords.matches(password, hash) || found.isEmpty()) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "AUTH_INVALID_CREDENTIALS",
                    "Invalid email or password.");
        }
        UserAccount user = found.orElseThrow();
        String raw = tokens.generate();
        sessions.create(user.id(), tokens.hash(raw), Instant.now().plus(properties.getSessionTtl()));
        audit.record(user.id(), "AUTH_LOGIN_SUCCEEDED");
        return new LoginResult(SafeUser.from(user), raw);
    }

    @Transactional
    public String rotate(long sessionId) {
        String raw = tokens.generate();
        sessions.rotate(sessionId, tokens.hash(raw), Instant.now().plus(properties.getSessionTtl()));
        return raw;
    }

    @Transactional
    public void logout(long userId, long sessionId) {
        sessions.revoke(sessionId);
        audit.record(userId, "AUTH_LOGOUT");
    }
}
