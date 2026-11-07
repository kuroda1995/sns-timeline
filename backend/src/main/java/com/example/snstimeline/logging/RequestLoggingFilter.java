package com.example.snstimeline.logging;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.slf4j.event.Level;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * 全リクエストに requestId を付け(MDC とレスポンスの X-Request-Id ヘッダー)、1リクエスト1行のアクセスログを出す(設計書 8-2)。
 * Spring Security より先に動くよう、一番外側に置く。ログイン中のユーザーIDは {@link UserIdLoggingFilter} が MDC に入れる。
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class RequestLoggingFilter extends OncePerRequestFilter {

    public static final String REQUEST_ID_HEADER = "X-Request-Id";
    /** ALB が付けるリクエストのID(例: Root=1-67891233-abcdef012345678912345678) */
    static final String AMZN_TRACE_ID_HEADER = "X-Amzn-Trace-Id";

    /** ヘッダーから受け取るIDの形。改行などを含む値でログを偽装されないよう、これ以外は使わずに新しく発行する */
    private static final Pattern VALID_ID = Pattern.compile("[A-Za-z0-9._-]{1,64}");
    private static final Pattern AMZN_ROOT = Pattern.compile("Root=([^;]+)");

    /** ALB のヘルスチェックは30秒ごとに届くため、アクセスログは DEBUG にして通常は出さない */
    private static final String HEALTH_CHECK_PATH = "/api/health";

    private static final Logger log = LoggerFactory.getLogger(RequestLoggingFilter.class);

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String requestId = resolveRequestId(request);
        MDC.put(LogFields.REQUEST_ID, requestId);
        response.setHeader(REQUEST_ID_HEADER, requestId);
        long start = System.nanoTime();
        boolean failed = false;
        try {
            chain.doFilter(request, response);
        } catch (IOException | ServletException | RuntimeException e) {
            failed = true;
            throw e;
        } finally {
            long durationMs = (System.nanoTime() - start) / 1_000_000;
            // 例外がここまで届いた場合、ステータスはまだ設定されていないことがあるため 500 とみなす
            int status = failed ? HttpServletResponse.SC_INTERNAL_SERVER_ERROR : response.getStatus();
            Level level = HEALTH_CHECK_PATH.equals(request.getRequestURI()) ? Level.DEBUG : Level.INFO;
            log.atLevel(level)
                    .setMessage("{} {} {} {}ms")
                    .addArgument(request.getMethod())
                    .addArgument(request.getRequestURI())
                    .addArgument(status)
                    .addArgument(durationMs)
                    .addKeyValue(LogFields.EVENT, "http.access")
                    .addKeyValue("method", request.getMethod())
                    // クエリ文字列(検索キーワードなど)は個人情報を含むことがあるため、パスだけを出す
                    .addKeyValue("path", request.getRequestURI())
                    .addKeyValue("status", status)
                    .addKeyValue("durationMs", durationMs)
                    .log();
            MDC.remove(LogFields.USER_ID);
            MDC.remove(LogFields.REQUEST_ID);
        }
    }

    /** X-Request-Id → ALB の X-Amzn-Trace-Id(Root) → 新しく発行、の順に使う */
    static String resolveRequestId(HttpServletRequest request) {
        String requestId = request.getHeader(REQUEST_ID_HEADER);
        if (requestId != null && VALID_ID.matcher(requestId).matches()) {
            return requestId;
        }
        String traceId = request.getHeader(AMZN_TRACE_ID_HEADER);
        if (traceId != null) {
            Matcher root = AMZN_ROOT.matcher(traceId);
            if (root.find() && VALID_ID.matcher(root.group(1)).matches()) {
                return root.group(1);
            }
        }
        return UUID.randomUUID().toString();
    }
}
