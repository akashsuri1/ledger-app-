package com.ledgerflow.auth;

public interface PasswordResetNotifier {
    void sendPasswordReset(UserAccount user, String rawToken);
}
