package com.ledgerflow.security;

import java.io.IOException;
import java.time.Instant;
import java.util.Arrays;
import java.util.List;

import com.ledgerflow.auth.AuthSessionRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
public class OpaqueSessionAuthenticationFilter extends OncePerRequestFilter {
    public static final String EXPIRED_ATTRIBUTE = OpaqueSessionAuthenticationFilter.class.getName() + ".expired";
    private final LedgerFlowSecurityProperties properties;
    private final TokenService tokens;
    private final AuthSessionRepository sessions;

    public OpaqueSessionAuthenticationFilter(LedgerFlowSecurityProperties properties,
                                              TokenService tokens, AuthSessionRepository sessions) {
        this.properties = properties;
        this.tokens = tokens;
        this.sessions = sessions;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {
        String raw = cookie(request, properties.getSessionCookieName());
        if (raw != null && SecurityContextHolder.getContext().getAuthentication() == null) {
            sessions.findByHash(tokens.hash(raw)).ifPresent(session -> {
                if (!session.isRevoked() && !session.isExpired(Instant.now())) {
                    var principal = new AuthenticatedUser(session.userId(), session.id(),
                            session.name(), session.email());
                    SecurityContextHolder.getContext().setAuthentication(
                            new UsernamePasswordAuthenticationToken(principal, null, List.of()));
                } else if (session.isExpired(Instant.now())) {
                    request.setAttribute(EXPIRED_ATTRIBUTE, true);
                }
            });
        }
        chain.doFilter(request, response);
    }

    private String cookie(HttpServletRequest request, String name) {
        if (request.getCookies() == null) return null;
        return Arrays.stream(request.getCookies()).filter(cookie -> name.equals(cookie.getName()))
                .map(Cookie::getValue).findFirst().orElse(null);
    }
}
