package com.example.snstimeline.dto;

import java.util.List;

/** U-02 新しく参加したユーザーのレスポンス。items の形は U-01 と同じ(ページングは無し) */
public record UserListResponse(List<UserSummary> items) {
}
