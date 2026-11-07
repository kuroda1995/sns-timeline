package com.example.snstimeline.logging;

/**
 * ログの項目名(設計書 8章)。CloudWatch Logs Insights などで検索・集計するときに使う名前なので、勝手に変えない。
 * <ul>
 * <li>MDC: そのリクエストの間に出したすべてのログに自動で付く</li>
 * <li>キー・値: SLF4J の {@code addKeyValue} でログ1件ごとに付ける</li>
 * </ul>
 */
public final class LogFields {

    /** MDC: 1つのリクエストで出たログを結び付けるID。レスポンスの X-Request-Id ヘッダーでも返す */
    public static final String REQUEST_ID = "requestId";

    /** MDC: ログイン中のユーザーID(JWT の sub)。未ログインのリクエストには付かない */
    public static final String USER_ID = "userId";

    /**
     * 何が起きたか(例: post.created)。「対象.動作」の形にする。
     * ECS(Elastic Common Schema)の項目名に合わせ、JSON では {"event":{"action":"post.created"}} になる
     */
    public static final String EVENT = "event.action";

    private LogFields() {
    }
}
