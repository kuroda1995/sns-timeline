package com.example.snstimeline.logging;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.function.Consumer;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.WebApplicationType;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.context.annotation.Configuration;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * application.properties・application-aws.properties のログの出力形式を確かめる(設計書 8-1)。
 * DB などは使わず、ログの設定だけを読み込んでアプリを起動する。
 */
@ExtendWith(OutputCaptureExtension.class)
class StructuredLoggingFormatTest {

    private static final Logger log = LoggerFactory.getLogger(StructuredLoggingFormatTest.class);

    @Configuration(proxyBeanMethods = false)
    static class NoBeans {
    }

    /** プロファイルを指定して起動し、MDC とキー・値の付いたログを1件出して、その行を返す */
    private static String logLine(CapturedOutput output, String... profiles) {
        SpringApplication app = new SpringApplication(NoBeans.class);
        app.setWebApplicationType(WebApplicationType.NONE);
        app.setAdditionalProfiles(profiles);
        try (ConfigurableApplicationContext context = app.run("--spring.main.banner-mode=off")) {
            MDC.put(LogFields.REQUEST_ID, "req-123");
            MDC.put(LogFields.USER_ID, "42");
            log.atInfo().setMessage("投稿しました").addKeyValue(LogFields.EVENT, "post.created")
                    .addKeyValue("postId", 120L).log();
        } finally {
            MDC.clear();
        }
        return output.getOut().lines().filter(line -> line.contains("投稿しました")).reduce((a, b) -> b).orElseThrow();
    }

    @Test
    void awsプロファイルではECS形式のJSONで出力し_MDCとキー値を項目にする(CapturedOutput output) {
        assertJson(logLine(output, "aws"), json -> {
            assertThat(json.path("message").asString()).isEqualTo("投稿しました");
            assertThat(json.path("log").path("level").asString()).isEqualTo("INFO");
            assertThat(json.path("service").path("name").asString()).isEqualTo("sns-timeline");
            assertThat(json.path("requestId").asString()).isEqualTo("req-123");
            assertThat(json.path("userId").asString()).isEqualTo("42");
            assertThat(json.path("event").path("action").asString()).isEqualTo("post.created");
            assertThat(json.path("postId").asLong()).isEqualTo(120L);
            assertThat(json.has("@timestamp")).isTrue();
        });
    }

    @Test
    void プロファイルを指定しなければ人が読める1行テキストで_requestIdとキー値も表示する(CapturedOutput output) {
        String line = logLine(output);

        assertThat(line).doesNotStartWith("{")
                .contains("INFO", "[req-123]", "投稿しました", "event.action=\"post.created\"", "postId=\"120\"");
    }

    /**
     * ログの設定は JVM 全体で共有されるため、aws プロファイルの JSON 形式のままだと後に動くテストの出力まで JSON になる。
     * 最後にプロファイル無しで起動し直し、通常の設定に戻す
     */
    @AfterAll
    static void restoreDefaultLogging() {
        SpringApplication app = new SpringApplication(NoBeans.class);
        app.setWebApplicationType(WebApplicationType.NONE);
        app.run("--spring.main.banner-mode=off").close();
    }

    private static void assertJson(String line, Consumer<JsonNode> assertions) {
        assertions.accept(JsonMapper.builder().build().readTree(line));
    }
}
