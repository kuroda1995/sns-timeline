package com.example.snstimeline.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.example.snstimeline.exception.ApiException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.http.HttpStatus;

class ContentRulesTest {

    private static void assertBadRequest(Runnable action, String message) {
        assertThatThrownBy(action::run).isInstanceOfSatisfying(ApiException.class, e -> {
            assertThat(e.getStatus()).isEqualTo(HttpStatus.BAD_REQUEST);
            assertThat(e.getMessage()).isEqualTo(message);
            assertThat(e.getField()).isEqualTo("content");
        });
    }

    @Test
    void normalize_前後の空白と改行を取り除く() {
        assertThat(ContentRules.normalize("  \n こんにちは \n ")).isEqualTo("こんにちは");
    }

    @Test
    void normalize_途中の改行はCRLFもCRもLFにそろえて残す() {
        assertThat(ContentRules.normalize("1行目\r\n2行目\r3行目")).isEqualTo("1行目\n2行目\n3行目");
    }

    @Test
    void normalize_ちょうど140文字なら受け付ける() {
        String content = "あ".repeat(140);

        assertThat(ContentRules.normalize(content)).isEqualTo(content);
    }

    @Test
    void normalize_141文字は400() {
        assertBadRequest(() -> ContentRules.normalize("あ".repeat(141)), "140文字以内で入力してください");
    }

    @Test
    void normalize_絵文字は1文字と数える() {
        // 😀 は Java の char では2つ分だが、画面と同じく1文字と数える
        String emoji = "😀".repeat(140);

        assertThat(ContentRules.normalize(emoji)).isEqualTo(emoji);
        assertBadRequest(() -> ContentRules.normalize(emoji + "😀"), "140文字以内で入力してください");
    }

    @Test
    void normalize_CRLFの改行は1文字と数える() {
        // 139文字 + 改行1つ = 140文字。\r\n のまま数えると141文字になってしまう
        String content = "あ".repeat(70) + "\r\n" + "い".repeat(69);

        assertThat(ContentRules.normalize(content)).hasSize(140);
    }

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = {"   ", "\n\r\n\t"})
    void normalize_空や空白だけは400(String content) {
        assertBadRequest(() -> ContentRules.normalize(content), "本文を入力してください");
    }

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = {"   "})
    void normalizeAllowingEmpty_空や空白だけは空文字として受け付ける(String content) {
        assertThat(ContentRules.normalizeAllowingEmpty(content)).isEmpty();
    }

    @Test
    void normalizeAllowingEmpty_141文字は400() {
        assertBadRequest(() -> ContentRules.normalizeAllowingEmpty("a".repeat(141)), "140文字以内で入力してください");
    }
}
