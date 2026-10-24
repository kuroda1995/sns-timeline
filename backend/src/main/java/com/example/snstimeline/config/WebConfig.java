package com.example.snstimeline.config;

import java.nio.file.Path;
import java.time.Duration;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.CacheControl;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * フェーズ1(ローカル)で、backend/uploads/ に保存した画像を /uploads/** で配信する(設計書 5章)。
 * ファイル名は UUID で、一度保存した画像は書き換えないため、ブラウザに長めにキャッシュさせる。
 * 保存先は LocalImageStorage と同じ設定値(app.storage.local-dir)を使う。
 */
@Configuration
public class WebConfig implements WebMvcConfigurer {

    private final Path uploadDir;

    public WebConfig(@Value("${app.storage.local-dir:uploads}") String localDir) {
        this.uploadDir = Path.of(localDir).toAbsolutePath().normalize();
    }

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        registry.addResourceHandler("/uploads/**")
                .addResourceLocations(uploadDir.toUri().toString())
                .setCacheControl(CacheControl.maxAge(Duration.ofDays(30)));
    }
}
