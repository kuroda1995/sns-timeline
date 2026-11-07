package com.example.snstimeline.logging;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class LogMasksTest {

    @Test
    void email_先頭1文字と_at以降だけを残す() {
        assertThat(LogMasks.email("hanako@example.com")).isEqualTo("h***@example.com");
        assertThat(LogMasks.email("a@example.com")).isEqualTo("a***@example.com");
    }

    @Test
    void email_メールアドレスの形でなければすべて隠す() {
        assertThat(LogMasks.email("hanako")).isEqualTo("***");
        assertThat(LogMasks.email("@example.com")).isEqualTo("***");
        assertThat(LogMasks.email(null)).isEmpty();
        assertThat(LogMasks.email("  ")).isEmpty();
    }
}
