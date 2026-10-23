package com.example.snstimeline.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.example.snstimeline.config.CorsConfig;
import com.example.snstimeline.config.JwtConfig;
import com.example.snstimeline.config.SecurityConfig;
import com.example.snstimeline.dto.CommentCountResponse;
import com.example.snstimeline.dto.CommentResponse;
import com.example.snstimeline.dto.CreateCommentResponse;
import com.example.snstimeline.dto.PageResponse;
import com.example.snstimeline.dto.PostResponse.AuthorResponse;
import com.example.snstimeline.entity.User;
import com.example.snstimeline.exception.ApiException;
import com.example.snstimeline.service.CommentService;
import com.example.snstimeline.service.JwtService;
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

@WebMvcTest(CommentController.class)
@Import({SecurityConfig.class, CorsConfig.class, JwtConfig.class, JwtService.class})
@TestPropertySource(properties = "app.jwt.secret=test-secret-key-that-is-at-least-32-bytes-long")
class CommentControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JwtService jwtService;

    @MockitoBean
    private CommentService commentService;

    private static final CommentResponse COMMENT = new CommentResponse(501L,
            new AuthorResponse(3L, "taro", "太郎", null), "<b>参考になります！</b>", false,
            Instant.parse("2026-10-02T04:00:00Z"));

    private String bearer(long userId) {
        User user = new User("hanako", "hanako@example.com", "hash", "花子");
        ReflectionTestUtils.setField(user, "id", userId);
        return "Bearer " + jwtService.issue(user);
    }

    @Test
    void list_cursorを渡してページング付きの一覧を返す() throws Exception {
        when(commentService.list(2L, 120L, 500L)).thenReturn(new PageResponse<>(List.of(COMMENT), null, false));

        mockMvc.perform(get("/api/posts/120/comments").param("cursor", "500").header("Authorization", bearer(2L)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].id").value(501))
                .andExpect(jsonPath("$.items[0].author.username").value("taro"))
                // 本文はHTMLとして加工せず、そのまま返す(画面側で文字として表示する)
                .andExpect(jsonPath("$.items[0].content").value("<b>参考になります！</b>"))
                .andExpect(jsonPath("$.items[0].isMine").value(false))
                .andExpect(jsonPath("$.items[0].createdAt").value("2026-10-02T04:00:00Z"))
                .andExpect(jsonPath("$.nextCursor").isEmpty())
                .andExpect(jsonPath("$.hasNext").value(false));
    }

    @Test
    void list_削除済みの投稿は404() throws Exception {
        when(commentService.list(2L, 99L, null))
                .thenThrow(new ApiException(HttpStatus.NOT_FOUND, "この投稿は削除されたか、存在しません"));

        mockMvc.perform(get("/api/posts/99/comments").header("Authorization", bearer(2L)))
                .andExpect(status().isNotFound());
    }

    @Test
    void create_JSONで本文を受け取り201でコメントとコメント数を返す() throws Exception {
        when(commentService.create(2L, 120L, "参考になります！")).thenReturn(new CreateCommentResponse(COMMENT, 13));

        mockMvc.perform(post("/api/posts/120/comments").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"content\":\"参考になります！\"}")
                        .header("Authorization", bearer(2L)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.comment.id").value(501))
                .andExpect(jsonPath("$.commentCount").value(13));
    }

    @Test
    void create_入力チェックエラーは400で項目のエラーを返す() throws Exception {
        when(commentService.create(eq(2L), eq(120L), any()))
                .thenThrow(new ApiException(HttpStatus.BAD_REQUEST, "本文を入力してください", "content"));

        mockMvc.perform(post("/api/posts/120/comments").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"content\":\"  \"}")
                        .header("Authorization", bearer(2L)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("content"))
                .andExpect(jsonPath("$.errors[0].message").value("本文を入力してください"));
    }

    @Test
    void create_JWTが無ければ401() throws Exception {
        mockMvc.perform(post("/api/posts/120/comments").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"content\":\"a\"}"))
                .andExpect(status().isUnauthorized());
        verifyNoInteractions(commentService);
    }

    @Test
    void delete_成功すると最新のコメント数を返す() throws Exception {
        when(commentService.delete(2L, 501L)).thenReturn(new CommentCountResponse(12));

        mockMvc.perform(delete("/api/comments/501").header("Authorization", bearer(2L)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.commentCount").value(12));
    }

    @Test
    void delete_他人のコメントは403() throws Exception {
        when(commentService.delete(3L, 501L))
                .thenThrow(new ApiException(HttpStatus.FORBIDDEN, "このコメントは削除できません"));

        mockMvc.perform(delete("/api/comments/501").header("Authorization", bearer(3L)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message").value("このコメントは削除できません"));
    }
}
