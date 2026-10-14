package com.example.snstimeline.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.Locale;

/** A-01 新規登録のリクエスト(入力チェックは 認証機能.md SC-02 の表に対応) */
public record SignupRequest(
        @NotBlank(message = "ユーザー名を入力してください")
        @Size(min = 3, max = 15, message = "3〜15文字で入力してください")
        @Pattern(regexp = "^[A-Za-z0-9_]*$", message = "半角英数字と _ のみ使用できます")
        String username,

        @NotBlank(message = "表示名を入力してください")
        @Size(max = 50, message = "50文字以内で入力してください")
        String displayName,

        @NotBlank(message = "メールアドレスを入力してください")
        @Email(message = "メールアドレスの形式で入力してください")
        @Size(max = 255, message = "255文字以内で入力してください")
        String email,

        @NotBlank(message = "パスワードを入力してください")
        @Size(min = 8, max = 72, message = "8〜72文字で入力してください")
        @Pattern(regexp = PasswordRules.PATTERN, message = PasswordRules.MESSAGE)
        String password) {

    public SignupRequest {
        // 入力チェックの前に正規化する(処理のルール No.6)
        email = email == null ? null : email.trim().toLowerCase(Locale.ROOT);
        displayName = displayName == null ? null : displayName.strip();
    }

    /** パスワードがログに出ないようにする */
    @Override
    public String toString() {
        return "SignupRequest[username=" + username + ", displayName=" + displayName
                + ", email=" + email + ", password=***]";
    }
}
