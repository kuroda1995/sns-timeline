package com.example.snstimeline.service.storage;

import com.example.snstimeline.exception.ApiException;
import java.io.IOException;
import java.io.UncheckedIOException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;

/**
 * アップロードされた画像の形式・サイズのチェック(画像投稿機能 処理のルール No.1・6)。
 * 投稿画像とアイコン画像で共通。画面でも同じチェックをするが、APIを直接呼ばれた場合に備えてサーバーでも行う。
 */
@Component
public class ImageValidator {

    /** 1枚の上限(spring.servlet.multipart.max-file-size と同じ) */
    public static final long MAX_SIZE = 5L * 1024 * 1024;
    static final String TYPE_MESSAGE = "jpg・png・gif・webp の画像を選んでください";
    static final String SIZE_MESSAGE = "5MB以下の画像を選んでください";

    /** チェック済みの画像。content はファイルの中身、type は判定した形式 */
    public record ValidatedImage(byte[] content, ImageType type) {
    }

    /**
     * @param field エラーのときに画面に返す項目名(images・avatar)
     */
    public ValidatedImage validate(MultipartFile file, String field) {
        if (file.getSize() > MAX_SIZE) {
            throw new ApiException(HttpStatus.PAYLOAD_TOO_LARGE, SIZE_MESSAGE, field);
        }
        byte[] content;
        try {
            content = file.getBytes();
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
        // 拡張子・Content-Type は送る側で自由に変えられるため、中身の先頭のバイト列で判定する
        ImageType type = ImageType.detect(content)
                .orElseThrow(() -> new ApiException(HttpStatus.BAD_REQUEST, TYPE_MESSAGE, field));
        return new ValidatedImage(content, type);
    }
}
