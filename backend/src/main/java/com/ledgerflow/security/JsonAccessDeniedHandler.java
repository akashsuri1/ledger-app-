package com.ledgerflow.security;

import java.io.IOException;

import com.ledgerflow.web.ApiErrorEnvelope;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.MediaType;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.security.web.csrf.InvalidCsrfTokenException;
import org.springframework.security.web.csrf.MissingCsrfTokenException;
import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper;

@Component
public class JsonAccessDeniedHandler implements AccessDeniedHandler {
    private final ObjectMapper mapper;
    public JsonAccessDeniedHandler(ObjectMapper mapper) { this.mapper = mapper; }
    @Override
    public void handle(HttpServletRequest request, HttpServletResponse response,
                       AccessDeniedException exception) throws IOException {
        response.setStatus(HttpServletResponse.SC_FORBIDDEN);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        boolean csrf = exception instanceof InvalidCsrfTokenException
                || exception instanceof MissingCsrfTokenException;
        mapper.writeValue(response.getOutputStream(), ApiErrorEnvelope.of(
                csrf ? "CSRF_INVALID" : "ACCESS_DENIED",
                csrf ? "The CSRF token is missing or invalid." : "Access is denied."));
    }
}
