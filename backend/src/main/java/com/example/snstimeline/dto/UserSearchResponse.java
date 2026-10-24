package com.example.snstimeline.dto;

import java.util.List;

/**
 * U-01 ユーザー検索のレスポンス。検索結果は「完全一致を先頭に」という並び順のためIDをカーソルにできず、
 * ページ番号方式(page は0始まり)にする(ユーザー検索機能 9章)。
 */
public record UserSearchResponse(List<UserSummary> items, int page, boolean hasNext) {
}
