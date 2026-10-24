package com.example.snstimeline.service.storage;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class LocalImageStorageTest {

    @TempDir
    Path tempDir;

    private LocalImageStorage storage;

    @BeforeEach
    void setUp() {
        storage = new LocalImageStorage(tempDir.toString(), "http://localhost:8080/uploads/");
    }

    @Test
    void save_UUIDのファイル名で保存し保存キーを返す_同じ中身でも上書きしない() throws Exception {
        byte[] content = {1, 2, 3};

        String key1 = storage.save(content, "posts/2026/10", "png");
        String key2 = storage.save(content, "posts/2026/10", "png");

        assertThat(key1).matches("posts/2026/10/[0-9a-f-]{36}\\.png");
        assertThat(key2).isNotEqualTo(key1);
        assertThat(Files.readAllBytes(tempDir.resolve(key1))).containsExactly(1, 2, 3);
        assertThat(Files.exists(tempDir.resolve(key2))).isTrue();
    }

    @Test
    void delete_削除する_無ければ何もしない() {
        String key = storage.save(new byte[] {1}, "avatars", "jpg");

        storage.delete(key);
        storage.delete(key);

        assertThat(Files.exists(tempDir.resolve(key))).isFalse();
    }

    @Test
    void toUrl_公開URLの先頭とキーをつなぐ_nullならnull() {
        assertThat(storage.toUrl("posts/2026/10/a.png")).isEqualTo("http://localhost:8080/uploads/posts/2026/10/a.png");
        assertThat(storage.toUrl(null)).isNull();
    }

    @Test
    void 保存先のフォルダの外を指すキーは受け付けない() {
        assertThatThrownBy(() -> storage.resolve("../secret.txt")).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> storage.resolve("posts/../../secret.txt")).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> storage.save(new byte[] {1}, "../outside", "png")).isInstanceOf(IllegalArgumentException.class);
    }
}
