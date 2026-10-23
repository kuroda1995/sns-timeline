package com.example.snstimeline.dto;

import com.example.snstimeline.dto.PostResponse.AuthorResponse;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.Instant;

/** コメント(コメント機能 C-01・C-02)。isMine は削除ボタンの表示に使う */
public record CommentResponse(
        Long id,
        AuthorResponse author,
        String content,
        @JsonProperty("isMine") boolean isMine,
        Instant createdAt) {
}
