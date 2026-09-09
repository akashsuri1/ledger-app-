package com.ledgerflow.security;

import java.io.IOException;
import java.time.Instant;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
public class AuthRateLimitFilter extends OncePerRequestFilter {
    private static final Set<String> PATHS = Set.of("/api/auth/register", "/api/auth/login",
            "/api/auth/forgot-password", "/api/auth/reset-password");
    private final LedgerFlowSecurityProperties properties;
    private final Map<String, Window> windows = new ConcurrentHashMap<>();
    public AuthRateLimitFilter(LedgerFlowSecurityProperties properties) { this.properties = properties; }

    @Override protected boolean shouldNotFilter(HttpServletRequest request) {
        return !"POST".equals(request.getMethod()) || !PATHS.contains(request.getRequestURI());
    }

    @Override protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                               FilterChain chain) throws ServletException, IOException {
        long now = Instant.now().toEpochMilli();
        long duration = properties.getAuthRateWindow().toMillis();
        String key = request.getRemoteAddr() + ':' + request.getRequestURI();
        Window window = windows.compute(key, (ignored, existing) ->
                existing == null || now - existing.startedAt >= duration
                        ? new Window(now, 1) : new Window(existing.startedAt, existing.count + 1));
        if (window.count > properties.getAuthRateLimit()) {
            response.setStatus(429);
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
            response.getWriter().write("{\"error\":{\"code\":\"RATE_LIMITED\",\"message\":\"Too many requests. Try again later.\",\"fields\":{}}}");
            return;
        }
        chain.doFilter(request, response);
    }

    private record Window(long startedAt, int count) {}
}
