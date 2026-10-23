package com.example.snstimeline.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.example.snstimeline.config.CorsConfig;
import com.example.snstimeline.config.JwtConfig;
import com.example.snstimeline.config.SecurityConfig;
import com.example.snstimeline.dto.NewPostsResponse;
import com.example.snstimeline.dto.PageResponse;
import com.example.snstimeline.dto.PostResponse;
import com.example.snstimeline.dto.PostResponse.AuthorResponse;
import com.example.snstimeline.entity.User;
import com.example.snstimeline.exception.ApiException;
import com.example.snstimeline.service.JwtService;
import com.example.snstimeline.service.PostQueryService;
import com.example.snstimeline.service.PostService;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest({PostController.class, TimelineController.class})
@Import({SecurityConfig.class, CorsConfig.class, JwtConfig.class, JwtService.class})
@TestPropertySource(properties = "app.jwt.secret=test-secret-key-that-is-at-least-32-bytes-long")
class PostControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JwtService jwtService;

    @MockitoBean
    private PostService postService;

    @MockitoBean
    private PostQueryService postQueryService;

    private static final PostResponse POST = new PostResponse(120L,
            new AuthorResponse(2L, "hanako", "花子", null), "<script>alert(1)</script>", List.of(),
            0, 0, false, true, false, Instant.parse("2026-10-02T03:34:56Z"));

    private String bearer(long userId) {
        User user = new User("hanako", "hanako@example.com", "hash", "花子");
        ReflectionTestUtils.setField(user, "id", userId);
        return "Bearer " + jwtService.issue(user);
    }

    @Test
    void create_multipartで本文を受け取り201で投稿を返す() throws Exception {
        when(postService.create(2L, "こんにちは")).thenReturn(POST);

        mockMvc.perform(multipart("/api/posts").param("content", "こんにちは")
                        .header("Authorization", bearer(2L)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(120))
                .andExpect(jsonPath("$.author.username").value("hanako"))
                // 本文はHTMLとして加工せず、そのまま返す(画面側で文字として表示する)
                .andExpect(jsonPath("$.content").value("<script>alert(1)</script>"))
                .andExpect(jsonPath("$.isMine").value(true))
                .andExpect(jsonPath("$.edited").value(false))
                .andExpect(jsonPath("$.likeCount").value(0))
                .andExpect(jsonPath("$.createdAt").value("2026-10-02T03:34:56Z"));
    }

    @Test
    void create_入力チェックエラーは400で項目のエラーを返す() throws Exception {
        when(postService.create(eq(2L), any()))
                .thenThrow(new ApiException(HttpStatus.BAD_REQUEST, "140文字以内で入力してください", "content"));

        mockMvc.perform(multipart("/api/posts").param("content", "長い本文")
                        .header("Authorization", bearer(2L)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("content"))
                .andExpect(jsonPath("$.errors[0].message").value("140文字以内で入力してください"));
    }

    @Test
    void create_JWTが無ければ401() throws Exception {
        mockMvc.perform(multipart("/api/posts").param("content", "こんにちは"))
                .andExpect(status().isUnauthorized());
        verifyNoInteractions(postService);
    }

    @Test
    void create_JSONで送ると415() throws Exception {
        mockMvc.perform(post("/api/posts").contentType(MediaType.APPLICATION_JSON).content("{\"content\":\"a\"}")
                        .header("Authorization", bearer(2L)))
                .andExpect(status().isUnsupportedMediaType());
    }

    @Test
    void get_存在しない投稿は404() throws Exception {
        when(postService.get(2L, 99L))
                .thenThrow(new ApiException(HttpStatus.NOT_FOUND, "この投稿は削除されたか、存在しません"));

        mockMvc.perform(get("/api/posts/99").header("Authorization", bearer(2L)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.message").value("この投稿は削除されたか、存在しません"));
    }

    @Test
    void get_IDが数値でなければ400() throws Exception {
        mockMvc.perform(get("/api/posts/abc").header("Authorization", bearer(2L)))
                .andExpect(status().isBadRequest());
    }

    @Test
    void update_JSONで本文を受け取り更新後の投稿を返す() throws Exception {
        when(postService.update(2L, 120L, "書き換えた")).thenReturn(POST);

        mockMvc.perform(put("/api/posts/120").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"content\":\"書き換えた\"}")
                        .header("Authorization", bearer(2L)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(120));
    }

    @Test
    void update_他人の投稿は403() throws Exception {
        when(postService.update(eq(3L), eq(120L), any()))
                .thenThrow(new ApiException(HttpStatus.FORBIDDEN, "この投稿は編集できません"));

        mockMvc.perform(put("/api/posts/120").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"content\":\"乗っ取り\"}")
                        .header("Authorization", bearer(3L)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message").value("この投稿は編集できません"));
    }

    @Test
    void delete_成功すると204() throws Exception {
        mockMvc.perform(delete("/api/posts/120").header("Authorization", bearer(2L)))
                .andExpect(status().isNoContent());
        verify(postService).delete(2L, 120L);
    }

    @Test
    void delete_他人の投稿は403() throws Exception {
        doThrow(new ApiException(HttpStatus.FORBIDDEN, "この投稿は削除できません"))
                .when(postService).delete(3L, 120L);

        mockMvc.perform(delete("/api/posts/120").header("Authorization", bearer(3L)))
                .andExpect(status().isForbidden());
    }

    @Test
    void timeline_cursorを渡してページング付きの一覧を返す() throws Exception {
        when(postQueryService.timeline(2L, 101L)).thenReturn(new PageResponse<>(List.of(POST), 81L, true));

        mockMvc.perform(get("/api/timeline").param("cursor", "101").header("Authorization", bearer(2L)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].id").value(120))
                .andExpect(jsonPath("$.nextCursor").value(81))
                .andExpect(jsonPath("$.hasNext").value(true));
    }

    @Test
    void timeline_cursorを省略すると最新から() throws Exception {
        when(postQueryService.timeline(2L, null)).thenReturn(new PageResponse<>(List.of(), null, false));

        mockMvc.perform(get("/api/timeline").header("Authorization", bearer(2L)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.nextCursor").isEmpty())
                .andExpect(jsonPath("$.hasNext").value(false));
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
        verify(postQueryService, never()).newPosts(anyLong(), anyLong());
    }
}
