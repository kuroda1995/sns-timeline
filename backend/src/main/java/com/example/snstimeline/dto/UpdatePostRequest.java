package com.example.snstimeline.dto;

/** P-04 投稿編集のリクエスト。入力チェックは投稿作成と同じルールのため PostService で行う */
public record UpdatePostRequest(String content) {
}
