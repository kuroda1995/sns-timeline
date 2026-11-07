package com.example.snstimeline.controller;

import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.example.snstimeline.config.CorsConfig;
import com.example.snstimeline.config.JwtConfig;
import com.example.snstimeline.config.SecurityConfig;
import com.example.snstimeline.dto.NewPostsResponse;
import com.example.snstimeline.dto.PageResponse;
import com.example.snstimeline.dto.PostResponse;
import com.example.snstimeline.entity.User;
import com.example.snstimeline.service.JwtService;
import com.example.snstimeline.service.PostQueryService;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(TimelineController.class)
@Import({SecurityConfig.class, CorsConfig.class, JwtConfig.class, JwtService.class})
@TestPropertySource(properties = "app.jwt.secret=test-secret-key-that-is-at-least-32-bytes-long")
class TimelineControllerTest {

    private static final PostResponse POST = new PostResponse(120L,
            new PostResponse.AuthorResponse(3L, "taro", "太郎", null), "こんにちは", List.of(),
            2, 1, false, false, false, Instant.parse("2026-11-01T00:00:00Z"));

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JwtService jwtService;

    @MockitoBean
    private PostQueryService postQueryService;

    private String bearer(long userId) {
        User user = new User("hanako", "hanako@example.com", "hash", "花子");
        ReflectionTestUtils.setField(user, "id", userId);
        return "Bearer " + jwtService.issue(user);
    }

    @Test
    void timeline_cursorを省略するとnullで呼び出しページを返す() throws Exception {
        when(postQueryService.timeline(2L, null)).thenReturn(new PageResponse<>(List.of(POST), 120L, true));

        mockMvc.perform(get("/api/timeline").header("Authorization", bearer(2L)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].id").value(120))
                .andExpect(jsonPath("$.items[0].author.username").value("taro"))
                .andExpect(jsonPath("$.items[0].isMine").value(false))
                .andExpect(jsonPath("$.nextCursor").value(120))
                .andExpect(jsonPath("$.hasNext").value(true));
    }

    @Test
    void timeline_cursorを渡すと2ページ目を取得する() throws Exception {
        when(postQueryService.timeline(2L, 120L)).thenReturn(new PageResponse<>(List.of(), null, false));

        mockMvc.perform(get("/api/timeline").param("cursor", "120").header("Authorization", bearer(2L)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items").isEmpty())
                .andExpect(jsonPath("$.nextCursor").isEmpty())
                .andExpect(jsonPath("$.hasNext").value(false));
    }

    @Test
    void timeline_cursorが数値でなければ400() throws Exception {
        mockMvc.perform(get("/api/timeline").param("cursor", "abc").header("Authorization", bearer(2L)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("リクエストの形式が正しくありません"));
        verifyNoInteractions(postQueryService);
    }

    @Test
    void newPosts_sinceより新しい投稿を返す() throws Exception {
        when(postQueryService.newPosts(2L, 100L)).thenReturn(new NewPostsResponse(List.of(POST), false));

        mockMvc.perform(get("/api/timeline/new").param("since", "100").header("Authorization", bearer(2L)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].id").value(120))
                .andExpect(jsonPath("$.hasMore").value(false));
    }

    @Test
    void newPosts_sinceが無ければ400() throws Exception {
        mockMvc.perform(get("/api/timeline/new").header("Authorization", bearer(2L)))
                .andExpect(status().isBadRequest());
        verifyNoInteractions(postQueryService);
    }

    @Test
    void JWTが無ければ401() throws Exception {
        mockMvc.perform(get("/api/timeline")).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/timeline/new").param("since", "0")).andExpect(status().isUnauthorized());
        verifyNoInteractions(postQueryService);
    }

    @Test
    void 署名が不正なJWTは401() throws Exception {
        String tampered = bearer(2L) + "x";

        mockMvc.perform(get("/api/timeline").header("Authorization", tampered)).andExpect(status().isUnauthorized());
        verifyNoInteractions(postQueryService);
    }
}
