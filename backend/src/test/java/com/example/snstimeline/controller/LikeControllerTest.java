package com.example.snstimeline.controller;

import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.example.snstimeline.config.CorsConfig;
import com.example.snstimeline.config.JwtConfig;
import com.example.snstimeline.config.SecurityConfig;
import com.example.snstimeline.dto.LikeResponse;
import com.example.snstimeline.entity.User;
import com.example.snstimeline.exception.ApiException;
import com.example.snstimeline.service.JwtService;
import com.example.snstimeline.service.LikeService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(LikeController.class)
@Import({SecurityConfig.class, CorsConfig.class, JwtConfig.class, JwtService.class})
@TestPropertySource(properties = "app.jwt.secret=test-secret-key-that-is-at-least-32-bytes-long")
class LikeControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JwtService jwtService;

    @MockitoBean
    private LikeService likeService;

    private String bearer(long userId) {
        User user = new User("hanako", "hanako@example.com", "hash", "花子");
        ReflectionTestUtils.setField(user, "id", userId);
        return "Bearer " + jwtService.issue(user);
    }

    @Test
    void like_ボディ無しで受け取り最新のいいね数を返す() throws Exception {
        when(likeService.like(2L, 120L)).thenReturn(new LikeResponse(36, true));

        mockMvc.perform(post("/api/posts/120/likes").header("Authorization", bearer(2L)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.likeCount").value(36))
                .andExpect(jsonPath("$.likedByMe").value(true));
    }

    @Test
    void unlike_最新のいいね数を返す() throws Exception {
        when(likeService.unlike(2L, 120L)).thenReturn(new LikeResponse(35, false));

        mockMvc.perform(delete("/api/posts/120/likes").header("Authorization", bearer(2L)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.likeCount").value(35))
                .andExpect(jsonPath("$.likedByMe").value(false));
    }

    @Test
    void like_削除済みの投稿は404() throws Exception {
        when(likeService.like(2L, 99L))
                .thenThrow(new ApiException(HttpStatus.NOT_FOUND, "この投稿は削除されたか、存在しません"));

        mockMvc.perform(post("/api/posts/99/likes").header("Authorization", bearer(2L)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.message").value("この投稿は削除されたか、存在しません"));
    }

    @Test
    void like_JWTが無ければ401() throws Exception {
        mockMvc.perform(post("/api/posts/120/likes")).andExpect(status().isUnauthorized());
        verifyNoInteractions(likeService);
    }
}
