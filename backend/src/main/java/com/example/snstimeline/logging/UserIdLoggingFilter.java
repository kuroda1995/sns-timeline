package com.example.snstimeline.logging;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.slf4j.MDC;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * JWT を検証した後に、ログイン中のユーザーID(JWT の sub)を MDC に入れる(設計書 8-2)。
 * Spring Security のフィルターの中(BearerTokenAuthenticationFilter の後ろ)で動かすため、
 * {@code @Component} にはせず SecurityConfig で登録する。MDC は外側の {@link RequestLoggingFilter} が片付ける。
 */
public class UserIdLoggingFilter extends OncePerRequestFilter {

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication instanceof JwtAuthenticationToken jwt) {
            MDC.put(LogFields.USER_ID, jwt.getToken().getSubject());
        }
        chain.doFilter(request, response);
    }
}
