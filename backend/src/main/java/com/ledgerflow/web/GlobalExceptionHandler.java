package com.ledgerflow.web;

import java.util.LinkedHashMap;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.multipart.support.MissingServletRequestPartException;

@RestControllerAdvice
public class GlobalExceptionHandler {
    @ExceptionHandler(ApiException.class)
    ResponseEntity<ApiErrorEnvelope> api(ApiException exception) {
        return ResponseEntity.status(exception.status())
                .body(ApiErrorEnvelope.of(exception.code(), exception.getMessage()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<ApiErrorEnvelope> validation(MethodArgumentNotValidException exception) {
        Map<String, String> fields = new LinkedHashMap<>();
        for (FieldError error : exception.getBindingResult().getFieldErrors()) {
            fields.putIfAbsent(error.getField(), error.getDefaultMessage());
        }
        return ResponseEntity.unprocessableEntity()
                .body(ApiErrorEnvelope.of("VALIDATION_ERROR", "The request contains invalid fields.", fields));
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    ResponseEntity<ApiErrorEnvelope> malformed() {
        return ResponseEntity.badRequest()
                .body(ApiErrorEnvelope.of("MALFORMED_REQUEST", "The request body is malformed."));
    }

    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    ResponseEntity<ApiErrorEnvelope> malformedParameter() {
        return ResponseEntity.badRequest()
                .body(ApiErrorEnvelope.of("MALFORMED_REQUEST", "A path or query parameter is malformed."));
    }

    @ExceptionHandler(MissingServletRequestParameterException.class)
    ResponseEntity<ApiErrorEnvelope> missingParameter(MissingServletRequestParameterException exception) {
        return ResponseEntity.badRequest()
                .body(ApiErrorEnvelope.of("MALFORMED_REQUEST",
                        "Required query parameter " + exception.getParameterName() + " is missing."));
    }

    @ExceptionHandler(MissingServletRequestPartException.class)
    ResponseEntity<ApiErrorEnvelope> missingPart() {
        return ResponseEntity.badRequest()
                .body(ApiErrorEnvelope.of("MALFORMED_REQUEST", "The required attachment file is missing."));
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    ResponseEntity<ApiErrorEnvelope> uploadTooLarge() {
        return ResponseEntity.status(HttpStatus.PAYLOAD_TOO_LARGE)
                .body(ApiErrorEnvelope.of("ATTACHMENT_TOO_LARGE",
                        "The attachment exceeds the configured size limit."));
    }

    @ExceptionHandler(Exception.class)
    ResponseEntity<ApiErrorEnvelope> unexpected(Exception exception) {
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ApiErrorEnvelope.of("INTERNAL_ERROR", "An unexpected error occurred."));
    }
}
