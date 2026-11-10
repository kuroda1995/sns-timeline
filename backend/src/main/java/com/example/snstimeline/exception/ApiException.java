package com.example.snstimeline.exception;

import java.io.Serial;
import org.springframework.http.HttpStatus;

/**
 * 業務ルール違反をHTTPステータス付きで返すための例外。
 * field を指定すると、エラーレスポンスの errors にその項目のエラーとして入る(画面で入力欄の下に表示する用)。
 */
public class ApiException extends RuntimeException {

    @Serial
    private static final long serialVersionUID = 1L;

    private final HttpStatus status;
    private final String field;

    public ApiException(HttpStatus status, String message) {
        this(status, message, null);
    }

    public ApiException(HttpStatus status, String message, String field) {
        this(status, message, field, null);
    }

    /**
     * 別の例外が原因のとき。画面に返すのは message だけで、cause はログで原因を追うために残す
     */
    public ApiException(HttpStatus status, String message, String field, Throwable cause) {
        super(message, cause);
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
