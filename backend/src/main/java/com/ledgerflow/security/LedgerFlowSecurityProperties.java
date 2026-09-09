package com.ledgerflow.security;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "ledgerflow.security")
public class LedgerFlowSecurityProperties {
    private String sessionCookieName = "LF_SESSION";
    private Duration sessionTtl = Duration.ofDays(7);
    private Duration resetTokenTtl = Duration.ofMinutes(30);
    private boolean secureCookies;
    private String sameSite = "Lax";
    private List<String> allowedOrigins = new ArrayList<>(List.of("http://localhost:5173"));
    private int authRateLimit = 30;
    private Duration authRateWindow = Duration.ofMinutes(1);

    public String getSessionCookieName() { return sessionCookieName; }
    public void setSessionCookieName(String value) { sessionCookieName = value; }
    public Duration getSessionTtl() { return sessionTtl; }
    public void setSessionTtl(Duration value) { sessionTtl = value; }
    public Duration getResetTokenTtl() { return resetTokenTtl; }
    public void setResetTokenTtl(Duration value) { resetTokenTtl = value; }
    public boolean isSecureCookies() { return secureCookies; }
    public void setSecureCookies(boolean value) { secureCookies = value; }
    public String getSameSite() { return sameSite; }
    public void setSameSite(String value) { sameSite = value; }
    public List<String> getAllowedOrigins() { return allowedOrigins; }
    public void setAllowedOrigins(List<String> value) { allowedOrigins = value; }
    public int getAuthRateLimit() { return authRateLimit; }
    public void setAuthRateLimit(int value) { authRateLimit = value; }
    public Duration getAuthRateWindow() { return authRateWindow; }
    public void setAuthRateWindow(Duration value) { authRateWindow = value; }
}
