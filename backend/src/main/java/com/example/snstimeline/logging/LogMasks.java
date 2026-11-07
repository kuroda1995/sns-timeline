package com.example.snstimeline.logging;

/** 個人情報をログに出すときに一部を隠す(設計書 8-4) */
public final class LogMasks {

    private LogMasks() {
    }

    /**
     * メールアドレスを「先頭1文字＋***＋@以降」にする(例: hanako@example.com → h***@example.com)。
     * 同じ人が何度もログインに失敗しているかの見当は付くが、アドレスそのものは分からない
     */
    public static String email(String email) {
        if (email == null || email.isBlank()) {
            return "";
        }
        int at = email.indexOf('@');
        if (at <= 0) {
            return "***";
        }
        return email.charAt(0) + "***" + email.substring(at);
    }
}
