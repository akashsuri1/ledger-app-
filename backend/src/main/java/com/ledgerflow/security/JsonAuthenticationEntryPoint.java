package com.ledgerflow.security;

import java.io.IOException;

import com.ledgerflow.web.ApiErrorEnvelope;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.MediaType;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper;

@Component
public class JsonAuthenticationEntryPoint implements AuthenticationEntryPoint {
    private final ObjectMapper mapper;
    public JsonAuthenticationEntryPoint(ObjectMapper mapper) { this.mapper = mapper; }

    @Override
    public void commence(HttpServletRequest request, HttpServletResponse response,
                         AuthenticationException exception) throws IOException {
        boolean expired = Boolean.TRUE.equals(request.getAttribute(OpaqueSessionAuthenticationFilter.EXPIRED_ATTRIBUTE));
        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        mapper.writeValue(response.getOutputStream(), ApiErrorEnvelope.of(
                expired ? "AUTH_SESSION_EXPIRED" : "AUTH_REQUIRED",
                expired ? "The session has expired." : "Authentication is required."));
    }
}
