package com.ledgerflow.web;

import java.util.List;

public record PagedEnvelope<T>(List<T> data, PageMeta meta) {
    public record PageMeta(int page, int pageSize, long total, long totalPages) {}

    public static <T> PagedEnvelope<T> of(List<T> data, int page, int pageSize, long total) {
        long totalPages = total == 0 ? 0 : (total + pageSize - 1) / pageSize;
        return new PagedEnvelope<>(data, new PageMeta(page, pageSize, total, totalPages));
    }
}
