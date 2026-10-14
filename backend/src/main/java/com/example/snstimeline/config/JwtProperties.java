package com.example.snstimeline.config;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;

/** app.jwt.* の設定値 */
@ConfigurationProperties(prefix = "app.jwt")
public record JwtProperties(String secret, Duration expiration) {

    /** HS256 の署名キーは256ビット(32バイト)以上が必要 */
    private static final int MIN_SECRET_BYTES = 32;

    public JwtProperties {
        if (secret == null || secret.getBytes(StandardCharsets.UTF_8).length < MIN_SECRET_BYTES) {
            throw new IllegalStateException("app.jwt.secret には32バイト以上の文字列を設定してください");
        }
        if (expiration == null) {
            expiration = Duration.ofHours(24);
        }
    }
}
