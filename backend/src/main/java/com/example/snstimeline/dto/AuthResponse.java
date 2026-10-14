package com.example.snstimeline.dto;

/** 新規登録・ログインのレスポンス */
public record AuthResponse(String token, UserResponse user) {
}
