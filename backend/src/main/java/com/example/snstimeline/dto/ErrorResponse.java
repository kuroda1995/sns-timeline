package com.example.snstimeline.dto;

import java.util.List;

/** エラーレスポンスの共通の形(設計書 4-1) */
public record ErrorResponse(int status, String message, List<FieldErrorItem> errors) {

    public record FieldErrorItem(String field, String message) {
    }

    public static ErrorResponse of(int status, String message) {
        return new ErrorResponse(status, message, List.of());
    }
}
