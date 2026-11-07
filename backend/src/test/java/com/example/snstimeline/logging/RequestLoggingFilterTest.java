package com.example.snstimeline.logging;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.spi.ILoggingEvent;
import com.example.snstimeline.support.LogCapture;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.util.HashMap;
import java.util.Map;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.slf4j.MDC;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

class RequestLoggingFilterTest {

    private final RequestLoggingFilter filter = new RequestLoggingFilter();
    private LogCapture logs;
    /** リクエストの処理中に見えていた MDC */
    private Map<String, String> mdcDuringRequest;

    @BeforeEach
    void setUp() {
        logs = LogCapture.of(RequestLoggingFilter.class);
    }

    @AfterEach
    void tearDown() {
        logs.close();
    }

    /** Controller の代わり。処理中の MDC を覚えておく */
    private MockFilterChain chain(int status) {
        return new MockFilterChain(new HttpServlet() {
            @Override
            protected void service(HttpServletRequest req, HttpServletResponse res) {
                mdcDuringRequest = new HashMap<>(MDC.getCopyOfContextMap() == null ? Map.of() : MDC.getCopyOfContextMap());
                res.setStatus(status);
            }
        });
    }

    private ILoggingEvent accessLog() {
        return logs.event("http.access").orElseThrow();
    }

    @Test
    void requestIdを発行してMDCとレスポンスヘッダーに入れ_終わったらMDCから消す() throws Exception {
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(new MockHttpServletRequest("GET", "/api/timeline"), response, chain(200));

        String requestId = response.getHeader(RequestLoggingFilter.REQUEST_ID_HEADER);
        assertThat(requestId).matches("[0-9a-f-]{36}");
        assertThat(mdcDuringRequest).containsEntry(LogFields.REQUEST_ID, requestId);
        assertThat(MDC.get(LogFields.REQUEST_ID)).isNull();
    }

    @Test
    void 正しい形のX_Request_Idが届いたらそれを使う() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/timeline");
        request.addHeader("X-Request-Id", "front-abc_123.4");
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, chain(200));

        assertThat(response.getHeader("X-Request-Id")).isEqualTo("front-abc_123.4");
    }

    @Test
    void 改行などを含むX_Request_Idは使わずに新しく発行する() {
        for (String invalid : new String[] {"abc\nINFO 偽のログ", "a".repeat(65), "", "a b"}) {
            MockHttpServletRequest request = new MockHttpServletRequest("GET", "/");
            request.addHeader("X-Request-Id", invalid);

            assertThat(RequestLoggingFilter.resolveRequestId(request)).isNotEqualTo(invalid).hasSize(36);
        }
    }

    @Test
    void ALBのX_Amzn_Trace_IdのRootを使う() {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/");
        request.addHeader("X-Amzn-Trace-Id", "Root=1-67891233-abcdef012345678912345678;Sampled=1");

        assertThat(RequestLoggingFilter.resolveRequestId(request)).isEqualTo("1-67891233-abcdef012345678912345678");
    }

    @Test
    void アクセスログを1リクエスト1行で出し_クエリ文字列は出さない() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/users/search");
        request.setQueryString("q=yamada");

        filter.doFilter(request, new MockHttpServletResponse(), chain(200));

        ILoggingEvent access = accessLog();
        assertThat(access.getLevel()).isEqualTo(Level.INFO);
        assertThat(LogCapture.keyValues(access))
                .containsEntry("method", "GET")
                .containsEntry("path", "/api/users/search")
                .containsEntry("status", 200)
                .containsKey("durationMs");
        assertThat(access.getFormattedMessage()).startsWith("GET /api/users/search 200 ").doesNotContain("yamada");
        // アクセスログ自体にも requestId が付く
        assertThat(access.getMDCPropertyMap()).containsKey(LogFields.REQUEST_ID);
    }

    @Test
    void ログイン中なら内側のフィルターが入れたuserIdがアクセスログに付き_終わったら消す() throws Exception {
        MockFilterChain chain = new MockFilterChain(new HttpServlet() {
            @Override
            protected void service(HttpServletRequest req, HttpServletResponse res) {
                MDC.put(LogFields.USER_ID, "42");
            }
        });

        filter.doFilter(new MockHttpServletRequest("GET", "/api/timeline"), new MockHttpServletResponse(), chain);

        assertThat(accessLog().getMDCPropertyMap()).containsEntry(LogFields.USER_ID, "42");
        assertThat(MDC.get(LogFields.USER_ID)).isNull();
    }

    @Test
    void 処理中に例外が起きたら500としてアクセスログを出し_例外はそのまま伝える() {
        MockFilterChain failing = new MockFilterChain(new HttpServlet() {
            @Override
            protected void service(HttpServletRequest req, HttpServletResponse res) {
                throw new IllegalStateException("boom");
            }
        });

        assertThatThrownBy(() -> filter.doFilter(new MockHttpServletRequest("POST", "/api/posts"),
                new MockHttpServletResponse(), failing)).isInstanceOf(IllegalStateException.class).hasMessage("boom");
        assertThat(LogCapture.keyValues(accessLog())).containsEntry("status", 500);
        assertThat(MDC.get(LogFields.REQUEST_ID)).isNull();
    }

    @Test
    void ヘルスチェックのアクセスログはDEBUGにする() throws Exception {
        filter.doFilter(new MockHttpServletRequest("GET", "/api/health"), new MockHttpServletResponse(), chain(200));

        // 通常の設定(INFO)では出ない
        assertThat(logs.event("http.access")).isEmpty();
    }
}
