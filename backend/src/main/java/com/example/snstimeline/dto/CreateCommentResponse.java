package com.example.snstimeline.dto;

/** C-02 のレスポンス。commentCount は他の人のコメントも含めた最新の数 */
public record CreateCommentResponse(CommentResponse comment, long commentCount) {
}
