package com.example.snstimeline.dto;

/**
 * パスワードの文字種ルール。
 * BCrypt は72バイトより後ろを無視するため、1文字=1バイトになる半角英数字・記号(スペースを除くASCII)に限定する。
 */
final class PasswordRules {

    static final String PATTERN = "^(?=.*[A-Za-z])(?=.*[0-9])[!-~]*$";
    static final String MESSAGE = "英字と数字を両方含めてください(使えるのは半角英数字・記号のみ)";

    private PasswordRules() {
    }
}
