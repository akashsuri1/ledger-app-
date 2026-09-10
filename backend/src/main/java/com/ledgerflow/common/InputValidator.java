package com.ledgerflow.common;

import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.regex.Pattern;

import com.ledgerflow.web.ApiException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;

@Component
public class InputValidator {
    private static final Pattern EMAIL = Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$");
    private static final Pattern PHONE = Pattern.compile("\\d{10}");

    public String requiredText(JsonNode body, String field) {
        JsonNode value = body.get(field);
        if (value == null || !value.isTextual() || TextNormalizer.display(value.asText()).isEmpty()) {
            invalid(field + " is required.");
        }
        return TextNormalizer.display(value.asText());
    }

    public String optionalText(JsonNode body, String field, String fallback) {
        JsonNode value = body.get(field);
        if (value == null) return fallback;
        if (!value.isTextual()) invalid(field + " must be text.");
        return TextNormalizer.optional(value.asText());
    }

    public long requiredPositiveId(JsonNode body, String field) {
        JsonNode value = body.get(field);
        if (value == null || !value.isIntegralNumber() || !value.canConvertToLong() || value.longValue() <= 0) {
            invalid(field + " must be a positive integer.");
        }
        return value.longValue();
    }

    public long requiredPositiveAmount(JsonNode body, String field) {
        JsonNode value = body.get(field);
        if (value == null || !value.isIntegralNumber() || !value.canConvertToLong() || value.longValue() <= 0) {
            invalid(field + " must be a positive whole-rupee integer.");
        }
        return value.longValue();
    }

    public LocalDate requiredDate(JsonNode body, String field) {
        JsonNode value = body.get(field);
        if (value == null || !value.isTextual()) invalid(field + " must be a YYYY-MM-DD calendar date.");
        return date(value.asText(), field);
    }

    public LocalDate optionalDate(String value, String field) {
        return value == null || value.isBlank() ? null : date(value, field);
    }

    public LocalDate date(String value, String field) {
        try {
            if (!value.matches("\\d{4}-\\d{2}-\\d{2}")) throw new DateTimeParseException("format", value, 0);
            return LocalDate.parse(value);
        } catch (DateTimeParseException exception) {
            throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "VALIDATION_ERROR",
                    field + " must be a valid YYYY-MM-DD calendar date.");
        }
    }

    public void phone(String phone) {
        if (!phone.isEmpty() && !PHONE.matcher(phone).matches()) invalid("phone must contain exactly 10 digits.");
    }

    public void email(String email) {
        if (!email.isEmpty() && !EMAIL.matcher(email).matches()) invalid("email must be valid.");
    }

    public void page(int page, int pageSize) {
        if (page < 1) invalid("page must be at least 1.");
        if (pageSize < 1 || pageSize > 100) invalid("pageSize must be between 1 and 100.");
    }

    public void dateRange(LocalDate from, LocalDate to) {
        if (from != null && to != null && from.isAfter(to)) {
            throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "INVALID_DATE_RANGE",
                    "from must be on or before to.");
        }
    }

    public void object(JsonNode body) {
        if (body == null || !body.isObject()) invalid("Request body must be an object.");
    }

    public void invalid(String message) {
        throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "VALIDATION_ERROR", message);
    }
}
