package com.ledgerflow.common;

import java.util.Locale;

public final class TextNormalizer {
    private TextNormalizer() {}

    public static String display(String value) {
        return value == null ? "" : value.strip().replaceAll("\\s+", " ");
    }

    public static String comparison(String value) {
        return display(value).toLowerCase(Locale.ROOT);
    }

    public static String optional(String value) {
        return value == null ? "" : value.strip();
    }

    public static String gstin(String value) {
        return optional(value).toUpperCase(Locale.ROOT);
    }

    public static String likePattern(String value) {
        return "%" + optional(value).toLowerCase(Locale.ROOT)
                .replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
    }
}
