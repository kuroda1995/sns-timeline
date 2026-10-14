package com.example.snstimeline.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import java.util.Locale;

/** A-02 ログインのリクエスト */
public record LoginRequest(
        @NotBlank(message = "メールアドレスを入力してください")
        @Email(message = "メールアドレスの形式で入力してください")
        String email,

        @NotBlank(message = "パスワードを入力してください")
        String password) {

    public LoginRequest {
        email = email == null ? null : email.trim().toLowerCase(Locale.ROOT);
    }

    /** パスワードがログに出ないようにする */
    @Override
    public String toString() {
        return "LoginRequest[email=" + email + ", password=***]";
    }
}
