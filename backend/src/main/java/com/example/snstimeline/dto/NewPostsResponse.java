package com.example.snstimeline.dto;

import java.util.List;

/**
 * T-02 新着投稿(TL-05)のレスポンス。
 * hasMore が true のときは items に入りきらない新着があるため、画面はタイムラインを読み込み直す。
 */
public record NewPostsResponse(List<PostResponse> items, boolean hasMore) {
}
