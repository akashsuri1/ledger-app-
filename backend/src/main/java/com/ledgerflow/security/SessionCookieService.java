package com.ledgerflow.security;

import java.time.Duration;

import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;

@Component
public class SessionCookieService {
    private final LedgerFlowSecurityProperties properties;
    public SessionCookieService(LedgerFlowSecurityProperties properties) { this.properties = properties; }

    public void set(HttpServletResponse response, String token) {
        response.addHeader(HttpHeaders.SET_COOKIE, cookie(token, properties.getSessionTtl()).toString());
    }

    public void clear(HttpServletResponse response) {
        response.addHeader(HttpHeaders.SET_COOKIE, cookie("", Duration.ZERO).toString());
    }

    private ResponseCookie cookie(String value, Duration maxAge) {
        return ResponseCookie.from(properties.getSessionCookieName(), value)
                .httpOnly(true).secure(properties.isSecureCookies()).sameSite(properties.getSameSite())
                .path("/").maxAge(maxAge).build();
    }
}
