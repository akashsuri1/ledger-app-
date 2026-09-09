package com.ledgerflow.web;

import java.util.Map;

public record ApiErrorEnvelope(ApiError error) {
    public record ApiError(String code, String message, Map<String, String> fields) {}

    public static ApiErrorEnvelope of(String code, String message) {
        return new ApiErrorEnvelope(new ApiError(code, message, Map.of()));
    }

    public static ApiErrorEnvelope of(String code, String message, Map<String, String> fields) {
        return new ApiErrorEnvelope(new ApiError(code, message, fields));
    }
}
