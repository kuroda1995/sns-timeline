package com.example.snstimeline.config;

/** API仕様書のグループ名(機能定義書の機能単位)。Controller の @Tag と OpenApiConfig の並び順で使う */
public final class ApiTags {

    public static final String AUTH = "認証";
    public static final String TIMELINE = "タイムライン";
    public static final String POST = "投稿";
    public static final String LIKE = "いいね";
    public static final String COMMENT = "コメント";
    public static final String USER_SEARCH = "ユーザー検索";
    public static final String PROFILE = "プロフィール";
    public static final String FOLLOW = "フォロー";

    private ApiTags() {
    }
}
