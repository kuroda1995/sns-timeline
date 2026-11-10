package com.example.snstimeline.service.storage;

import com.example.snstimeline.logging.LogFields;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * フェーズ1(ローカル)の画像の保存先。backend/uploads/ に保存し、/uploads/** で配信する(WebConfig)。
 * backend/uploads/ は .gitignore 済み。app.storage.type が未設定または local のときに使う(s3 なら S3ImageStorage)。
 */
@Component
@ConditionalOnProperty(name = "app.storage.type", havingValue = "local", matchIfMissing = true)
public class LocalImageStorage implements ImageStorage {

    private static final Logger log = LoggerFactory.getLogger(LocalImageStorage.class);

    private final Path root;
    private final String publicBaseUrl;

    public LocalImageStorage(@Value("${app.storage.local-dir:uploads}") String localDir,
            @Value("${app.storage.public-base-url:http://localhost:8080/uploads}") String publicBaseUrl) {
        this.root = Path.of(localDir).toAbsolutePath().normalize();
        this.publicBaseUrl = publicBaseUrl.endsWith("/") ? publicBaseUrl.substring(0, publicBaseUrl.length() - 1) : publicBaseUrl;
    }

    @Override
    public String save(byte[] content, String directory, String extension) {
        String key = directory + "/" + UUID.randomUUID() + "." + extension;
        Path path = resolve(key);
        try {
            Files.createDirectories(path.getParent());
            Files.write(path, content);
        } catch (IOException e) {
            throw new UncheckedIOException("画像を保存できませんでした: " + key, e);
        }
        return key;
    }

    @Override
    public void delete(String key) {
        try {
            Files.deleteIfExists(resolve(key));
        } catch (IOException e) {
            // 消せなくても、使われないファイルが残るだけなので処理は止めない
            log.atWarn().setMessage("画像を削除できませんでした").setCause(e)
                    .addKeyValue(LogFields.EVENT, "storage.delete.failed").addKeyValue("imageKey", key).log();
        }
    }

    @Override
    public String toUrl(String key) {
        return key == null ? null : publicBaseUrl + "/" + key;
    }

    /** 保存キーをファイルの場所に変える。../ などで保存先のフォルダの外を指すキーは受け付けない */
    Path resolve(String key) {
        Path path = root.resolve(key).normalize();
        if (!path.startsWith(root) || path.equals(root)) {
            throw new IllegalArgumentException("不正な保存キーです: " + key);
        }
        return path;
    }
}
