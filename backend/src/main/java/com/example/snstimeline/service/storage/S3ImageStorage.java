package com.example.snstimeline.service.storage;

import com.example.snstimeline.logging.LogFields;
import java.time.Duration;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import software.amazon.awssdk.core.exception.SdkException;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest;

/**
 * フェーズ2(AWS)の画像の保存先。非公開の S3 バケットに保存し、画面には署名付きURL(期限付きでだけ見られるURL)を返す(設計書 5章)。
 * app.storage.type=s3 のときだけ使う(aws プロファイル)。S3 への権限は ECS タスクの IAM ロールで渡し、アクセスキーは使わない。
 */
@Component
@ConditionalOnProperty(name = "app.storage.type", havingValue = "s3")
public class S3ImageStorage implements ImageStorage {

    private static final Logger log = LoggerFactory.getLogger(S3ImageStorage.class);

    private final S3Client s3;
    private final S3Presigner presigner;
    private final String bucket;
    private final Duration urlExpiration;

    public S3ImageStorage(S3Client s3, S3Presigner presigner,
            @Value("${app.storage.s3-bucket}") String bucket,
            @Value("${app.storage.url-expiration:1h}") Duration urlExpiration) {
        this.s3 = s3;
        this.presigner = presigner;
        this.bucket = bucket;
        this.urlExpiration = urlExpiration;
    }

    @Override
    public String save(byte[] content, String directory, String extension) {
        String key = directory + "/" + UUID.randomUUID() + "." + extension;
        s3.putObject(PutObjectRequest.builder()
                .bucket(bucket)
                .key(key)
                .contentType(contentType(extension))
                // ファイル名は UUID で、一度保存した画像は書き換えないため、ブラウザに長めにキャッシュさせる
                .cacheControl("private, max-age=3600")
                .build(), RequestBody.fromBytes(content));
        return key;
    }

    @Override
    public void delete(String key) {
        try {
            s3.deleteObject(DeleteObjectRequest.builder().bucket(bucket).key(key).build());
        } catch (SdkException e) {
            // 消せなくても、使われないファイルが残るだけなので処理は止めない(LocalImageStorage と同じ)
            log.atWarn().setMessage("画像を削除できませんでした").setCause(e)
                    .addKeyValue(LogFields.EVENT, "storage.delete.failed").addKeyValue("imageKey", key).log();
        }
    }

    @Override
    public String toUrl(String key) {
        if (key == null) {
            return null;
        }
        // 署名はサーバーの中で計算するだけで、S3 への通信は発生しない
        GetObjectPresignRequest request = GetObjectPresignRequest.builder()
                .signatureDuration(urlExpiration)
                .getObjectRequest(GetObjectRequest.builder().bucket(bucket).key(key).build())
                .build();
        return presigner.presignGetObject(request).url().toString();
    }

    /** 拡張子(ImageType#extension)から Content-Type を決める。ブラウザが画像として表示できるようにするため */
    static String contentType(String extension) {
        return switch (extension) {
            case "jpg" -> "image/jpeg";
            case "png" -> "image/png";
            case "gif" -> "image/gif";
            case "webp" -> "image/webp";
            default -> "application/octet-stream";
        };
    }
}
