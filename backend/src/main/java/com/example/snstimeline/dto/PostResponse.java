package com.example.snstimeline.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.Instant;
import java.util.List;

/** 投稿(設計書 4-3 の Post)。タイムライン・投稿詳細・投稿作成/編集のレスポンスで共通 */
public record PostResponse(
        Long id,
        AuthorResponse author,
        String content,
        List<ImageResponse> images,
        long likeCount,
        long commentCount,
        boolean likedByMe,
        @JsonProperty("isMine") boolean isMine,
        boolean edited,
        Instant createdAt) {

    /** 投稿者(設計書 4-3 の Post.author) */
    public record AuthorResponse(Long id, String username, String displayName, String avatarUrl) {
    }

    /** 投稿画像。画像投稿機能(IMG)で使う */
    public record ImageResponse(String url, int sortOrder) {
    }
}
