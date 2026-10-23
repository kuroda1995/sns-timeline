package com.example.snstimeline.dto;

/** C-02 コメント投稿のリクエスト。入力チェックは投稿と同じルールのため CommentService で行う */
public record CreateCommentRequest(String content) {
}
