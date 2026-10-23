package com.example.snstimeline.dto;

import com.example.snstimeline.entity.User;
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

    /** 投稿者(設計書 4-3 の Post.author)。コメントのコメント者でも使う */
    public record AuthorResponse(Long id, String username, String displayName, String avatarUrl) {

        public static AuthorResponse of(User user) {
            // avatarUrl は画像保存(ImageStorage)の実装時に avatar_key から組み立てる
            return new AuthorResponse(user.getId(), user.getUsername(), user.getDisplayName(), null);
        }
    }

    /** 投稿画像。画像投稿機能(IMG)で使う */
    public record ImageResponse(String url, int sortOrder) {
    }
}
