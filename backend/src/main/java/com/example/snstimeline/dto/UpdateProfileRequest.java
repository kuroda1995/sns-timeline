package com.example.snstimeline.dto;

/** U-05 プロフィール更新のリクエスト。入力チェックは UserService で行う(前後の空白を取り除いてから文字数を数えるため) */
public record UpdateProfileRequest(String displayName, String bio) {
}
