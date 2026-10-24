package com.example.snstimeline.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.example.snstimeline.config.CorsConfig;
import com.example.snstimeline.config.JwtConfig;
import com.example.snstimeline.config.SecurityConfig;
import com.example.snstimeline.dto.PageResponse;
import com.example.snstimeline.dto.ProfileResponse;
import com.example.snstimeline.dto.UpdateProfileRequest;
import com.example.snstimeline.entity.User;
import com.example.snstimeline.exception.ApiException;
import com.example.snstimeline.service.JwtService;
import com.example.snstimeline.dto.UserListResponse;
import com.example.snstimeline.dto.UserSearchResponse;
import com.example.snstimeline.dto.UserSummary;
import com.example.snstimeline.service.UserSearchService;
import com.example.snstimeline.service.UserService;
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

@WebMvcTest(UserController.class)
@Import({SecurityConfig.class, CorsConfig.class, JwtConfig.class, JwtService.class})
@TestPropertySource(properties = "app.jwt.secret=test-secret-key-that-is-at-least-32-bytes-long")
class UserControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JwtService jwtService;

    @MockitoBean
    private UserService userService;

    @MockitoBean
    private UserSearchService userSearchService;

    private static final ProfileResponse TARO = new ProfileResponse(3L, "taro", "太郎", null, "Javaを勉強中です。",
            12, 34, false, false, Instant.parse("2026-10-01T00:00:00Z"));

    private String bearer(long userId) {
        User user = new User("hanako", "hanako@example.com", "hash", "花子");
        ReflectionTestUtils.setField(user, "id", userId);
        return "Bearer " + jwtService.issue(user);
    }

    private static final UserSummary TARO_ROW = new UserSummary(3L, "taro", "太郎", null, "Javaを勉強中です", true, false);

    @Test
    void search_キーワードとページを渡して検索結果を返す() throws Exception {
        when(userSearchService.search(2L, "@taro", 1)).thenReturn(new UserSearchResponse(List.of(TARO_ROW), 1, false));

        mockMvc.perform(get("/api/users/search").param("q", "@taro").param("page", "1")
                        .header("Authorization", bearer(2L)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].username").value("taro"))
                .andExpect(jsonPath("$.items[0].followedByMe").value(true))
                .andExpect(jsonPath("$.page").value(1))
                .andExpect(jsonPath("$.hasNext").value(false));
    }

    @Test
    void search_pageを省略すると0ページ目() throws Exception {
        when(userSearchService.search(2L, "taro", 0)).thenReturn(new UserSearchResponse(List.of(), 0, false));

        mockMvc.perform(get("/api/users/search").param("q", "taro").header("Authorization", bearer(2L)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.page").value(0));
    }

    @Test
    void search_キーワードが空なら400() throws Exception {
        when(userSearchService.search(eq(2L), any(), eq(0)))
                .thenThrow(new ApiException(HttpStatus.BAD_REQUEST, "検索するキーワードを入力してください", "q"));

        mockMvc.perform(get("/api/users/search").header("Authorization", bearer(2L)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("q"));
    }

    @Test
    void newUsers_新しく参加したユーザーを返す() throws Exception {
        when(userSearchService.newUsers(2L)).thenReturn(new UserListResponse(List.of(TARO_ROW)));

        mockMvc.perform(get("/api/users/new").header("Authorization", bearer(2L)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].username").value("taro"));
    }

    @Test
    void profile_プロフィールを返す() throws Exception {
        when(userService.profile(2L, "taro")).thenReturn(TARO);

        mockMvc.perform(get("/api/users/taro").header("Authorization", bearer(2L)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.username").value("taro"))
                .andExpect(jsonPath("$.followingCount").value(12))
                .andExpect(jsonPath("$.followerCount").value(34))
                .andExpect(jsonPath("$.followedByMe").value(false))
                .andExpect(jsonPath("$.isMe").value(false))
                .andExpect(jsonPath("$.createdAt").value("2026-10-01T00:00:00Z"));
    }

    @Test
    void profile_存在しないユーザーは404() throws Exception {
        when(userService.profile(2L, "nobody"))
                .thenThrow(new ApiException(HttpStatus.NOT_FOUND, "このアカウントは存在しません"));

        mockMvc.perform(get("/api/users/nobody").header("Authorization", bearer(2L)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.message").value("このアカウントは存在しません"));
    }

    @Test
    void profile_JWTが無ければ401() throws Exception {
        mockMvc.perform(get("/api/users/taro")).andExpect(status().isUnauthorized());
        verifyNoInteractions(userService);
    }

    @Test
    void posts_cursorを渡してページング付きの一覧を返す() throws Exception {
        when(userService.posts(2L, "taro", 101L)).thenReturn(new PageResponse<>(List.of(), null, false));

        mockMvc.perform(get("/api/users/taro/posts").param("cursor", "101").header("Authorization", bearer(2L)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items").isArray())
                .andExpect(jsonPath("$.hasNext").value(false));
    }

    @Test
    void updateMe_ログイン中のユーザーのプロフィールを更新する() throws Exception {
        when(userService.updateMe(2L, new UpdateProfileRequest("はなこ", "よろしく"))).thenReturn(TARO);

        mockMvc.perform(put("/api/users/me").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"displayName\":\"はなこ\",\"bio\":\"よろしく\"}")
                        .header("Authorization", bearer(2L)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.username").value("taro"));
    }

    @Test
    void updateMe_入力チェックエラーは400で項目のエラーを返す() throws Exception {
        when(userService.updateMe(eq(2L), any()))
                .thenThrow(new ApiException(HttpStatus.BAD_REQUEST, "160文字以内で入力してください", "bio"));

        mockMvc.perform(put("/api/users/me").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"displayName\":\"花子\",\"bio\":\"長い\"}")
                        .header("Authorization", bearer(2L)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("bio"));
    }

    @Test
    void 他人のプロフィールを更新するAPIは無い() throws Exception {
        mockMvc.perform(put("/api/users/taro").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"displayName\":\"乗っ取り\",\"bio\":\"\"}")
                        .header("Authorization", bearer(2L)))
                .andExpect(status().isMethodNotAllowed());
        verifyNoInteractions(userService);
    }
}
