package com.example.snstimeline.exception;

import org.springframework.http.HttpStatus;

/**
 * 業務ルール違反をHTTPステータス付きで返すための例外。
 * field を指定すると、エラーレスポンスの errors にその項目のエラーとして入る(画面で入力欄の下に表示する用)。
 */
public class ApiException extends RuntimeException {

    private final HttpStatus status;
    private final String field;

    public ApiException(HttpStatus status, String message) {
        this(status, message, null);
    }

    public ApiException(HttpStatus status, String message, String field) {
        super(message);
        this.status = status;
        this.field = field;
    }

    public HttpStatus getStatus() {
        return status;
    }

    public String getField() {
        return field;
    }
}
