package com.ledgerflow.auth;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

@Component
public class NoOpPasswordResetNotifier implements PasswordResetNotifier {
    private static final Logger log = LoggerFactory.getLogger(NoOpPasswordResetNotifier.class);
    @Override public void sendPasswordReset(UserAccount user, String rawToken) {
        log.info("Password reset notification requested for user id {}", user.id());
    }
}
