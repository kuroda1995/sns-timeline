package com.example.snstimeline.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import io.swagger.v3.oas.annotations.media.Schema;

/**
 * ユーザー一覧の1行(設計書 4-3 の UserSummary)。フォロー中／フォロワー一覧で使い、ユーザー検索でも使う予定。
 * followedByMe は「ログイン中のユーザーが、この行の人をフォローしているか」(一覧の持ち主ではない)。
 */
public record UserSummary(
        Long id,
        String username,
        String displayName,
        @Schema(types = {"string", "null"}, description = "アイコン画像のURL。未設定なら null") String avatarUrl,
        String bio,
        boolean followedByMe,
        @JsonProperty("isMe") boolean isMe) {
}
