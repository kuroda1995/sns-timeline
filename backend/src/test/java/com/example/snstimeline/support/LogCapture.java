package com.example.snstimeline.support;

import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;
import org.slf4j.LoggerFactory;
import org.slf4j.event.KeyValuePair;

/**
 * テストの間に出たログを横取りして確かめる。try-with-resources で使い、終わったら必ず外す。
 * <pre>
 * try (LogCapture logs = LogCapture.root()) {
 *     ...
 *     assertThat(logs.event("post.created")).isPresent();
 * }
 * </pre>
 */
public final class LogCapture implements AutoCloseable {

    private final Logger logger;
    private final ListAppender<ILoggingEvent> appender = new ListAppender<>();

    private LogCapture(Logger logger) {
        this.logger = logger;
        appender.start();
        logger.addAppender(appender);
    }

    /** アプリ全体のログ */
    public static LogCapture root() {
        return new LogCapture((Logger) LoggerFactory.getLogger(org.slf4j.Logger.ROOT_LOGGER_NAME));
    }

    /** あるクラスのログ */
    public static LogCapture of(Class<?> type) {
        return new LogCapture((Logger) LoggerFactory.getLogger(type));
    }

    public List<ILoggingEvent> events() {
        return List.copyOf(appender.list);
    }

    /** event.action が action のログ(最初の1件) */
    public Optional<ILoggingEvent> event(String action) {
        return events().stream().filter(e -> action.equals(keyValues(e).get("event.action"))).findFirst();
    }

    /** ログに付けたキー・値 */
    public static Map<String, Object> keyValues(ILoggingEvent event) {
        List<KeyValuePair> pairs = event.getKeyValuePairs();
        return pairs == null ? Map.of() : pairs.stream().collect(Collectors.toMap(p -> p.key, p -> p.value));
    }

    /** メッセージ・キー・値・MDC・例外を1つの文字列にする(秘密情報が出ていないかの確認用) */
    public String allText() {
        StringBuilder text = new StringBuilder();
        for (ILoggingEvent event : events()) {
            text.append(event.getFormattedMessage()).append(' ')
                    .append(keyValues(event)).append(' ')
                    .append(event.getMDCPropertyMap()).append(' ');
            if (event.getThrowableProxy() != null) {
                text.append(event.getThrowableProxy().getMessage()).append(' ');
            }
            text.append('\n');
        }
        return text.toString();
    }

    @Override
    public void close() {
        logger.detachAppender(appender);
        appender.stop();
    }
}
