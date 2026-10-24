package com.example.snstimeline.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.Instant;

/**
 * U-03 プロフィール(プロフィール機能 7章)。
 * followedByMe はログイン中のユーザーがこの人をフォローしているか、isMe は自分のプロフィールか。
 */
public record ProfileResponse(
        Long id,
        String username,
        String displayName,
        String avatarUrl,
        String bio,
        long followingCount,
        long followerCount,
        boolean followedByMe,
        @JsonProperty("isMe") boolean isMe,
        Instant createdAt) {
}
