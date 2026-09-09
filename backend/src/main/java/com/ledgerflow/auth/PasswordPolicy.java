package com.ledgerflow.auth;

import java.nio.charset.StandardCharsets;

import com.ledgerflow.web.ApiException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

@Component
public class PasswordPolicy {
    public void validate(String password) {
        if (password == null || password.length() < 12 ||
                password.getBytes(StandardCharsets.UTF_8).length > 72) {
            throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "VALIDATION_ERROR",
                    "Password must be at least 12 characters and no more than 72 UTF-8 bytes.");
        }
    }
}
