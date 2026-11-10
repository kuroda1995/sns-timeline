package com.example.snstimeline.exception;

import com.example.snstimeline.dto.ErrorResponse;
import com.example.snstimeline.dto.ErrorResponse.FieldErrorItem;
import com.example.snstimeline.logging.LogFields;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.HttpMediaTypeNotSupportedException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

/** エラーレスポンスを設計書 4-1 の形にそろえる */
@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> handleValidation(MethodArgumentNotValidException e) {
        List<FieldErrorItem> errors = e.getBindingResult().getFieldErrors().stream()
                .map(fe -> new FieldErrorItem(fe.getField(), fe.getDefaultMessage()))
                .toList();
        return ResponseEntity.badRequest()
                .body(new ErrorResponse(400, "入力内容に誤りがあります", errors));
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ErrorResponse> handleUnreadable(HttpMessageNotReadableException e) {
        return ResponseEntity.badRequest().body(ErrorResponse.of(400, "リクエストの形式が正しくありません"));
    }

    /** /api/posts/abc のようにIDが数値でない、必須のパラメータが無い場合 */
    @ExceptionHandler({MethodArgumentTypeMismatchException.class, MissingServletRequestParameterException.class})
    public ResponseEntity<ErrorResponse> handleBadParameter(Exception e) {
        return ResponseEntity.badRequest().body(ErrorResponse.of(400, "リクエストの形式が正しくありません"));
    }

    @ExceptionHandler(HttpMediaTypeNotSupportedException.class)
    public ResponseEntity<ErrorResponse> handleMediaTypeNotSupported(HttpMediaTypeNotSupportedException e) {
        return ResponseEntity.status(HttpStatus.UNSUPPORTED_MEDIA_TYPE)
                .body(ErrorResponse.of(415, "リクエストの形式が正しくありません"));
    }

    @ExceptionHandler(ApiException.class)
    public ResponseEntity<ErrorResponse> handleApi(ApiException e) {
        List<FieldErrorItem> errors = e.getField() == null
                ? List.of()
                : List.of(new FieldErrorItem(e.getField(), e.getMessage()));
        int status = e.getStatus().value();
        if (e.getStatus() == HttpStatus.FORBIDDEN) {
            // 画面ではボタンを出していないので、APIを直接呼ばれた可能性がある(設計書 8-3)
            log.atWarn().setMessage("権限の無い操作を拒否しました: {}").addArgument(e.getMessage())
                    .addKeyValue(LogFields.EVENT, "security.forbidden").log();
        }
        return ResponseEntity.status(status).body(new ErrorResponse(status, e.getMessage(), errors));
    }

    /** 画像が1枚5MB・合計20MBを超えた(spring.servlet.multipart の上限) */
    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<ErrorResponse> handleMaxUploadSize(MaxUploadSizeExceededException e) {
        return ResponseEntity.status(HttpStatus.CONTENT_TOO_LARGE)
                .body(ErrorResponse.of(413, "画像は1枚5MB以下、合計20MB以下にしてください"));
    }

    @ExceptionHandler(NoResourceFoundException.class)
    public ResponseEntity<ErrorResponse> handleNotFound(NoResourceFoundException e) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(ErrorResponse.of(404, "見つかりません"));
    }

    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    public ResponseEntity<ErrorResponse> handleMethodNotSupported(HttpRequestMethodNotSupportedException e) {
        return ResponseEntity.status(HttpStatus.METHOD_NOT_ALLOWED)
                .body(ErrorResponse.of(405, "このメソッドは使えません"));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handleUnexpected(Exception e) {
        // ERROR はすぐに対応が必要なものだけに使う(AWS ではこのログの件数で通知する、設計書 8-3)
        log.atError().setMessage("想定外のエラーが発生しました").setCause(e)
                .addKeyValue(LogFields.EVENT, "error.unexpected").log();
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ErrorResponse.of(500, "サーバーでエラーが発生しました"));
    }
}
