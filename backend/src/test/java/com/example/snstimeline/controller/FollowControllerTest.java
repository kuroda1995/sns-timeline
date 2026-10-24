package com.example.snstimeline.controller;

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
import com.example.snstimeline.dto.FollowResponse;
import com.example.snstimeline.dto.PageResponse;
import com.example.snstimeline.dto.UserSummary;
import com.example.snstimeline.entity.User;
import com.example.snstimeline.exception.ApiException;
import com.example.snstimeline.service.FollowService;
import com.example.snstimeline.service.JwtService;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(FollowController.class)
@Import({SecurityConfig.class, CorsConfig.class, JwtConfig.class, JwtService.class})
@TestPropertySource(properties = "app.jwt.secret=test-secret-key-that-is-at-least-32-bytes-long")
class FollowControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JwtService jwtService;

    @MockitoBean
    private FollowService followService;

    private String bearer(long userId) {
        User user = new User("hanako", "hanako@example.com", "hash", "花子");
        ReflectionTestUtils.setField(user, "id", userId);
        return "Bearer " + jwtService.issue(user);
    }

    @Test
    void follow_ボディ無しで受け取り最新のフォロワー数を返す() throws Exception {
        when(followService.follow(2L, "taro")).thenReturn(new FollowResponse(true, 35));

        mockMvc.perform(post("/api/users/taro/follow").header("Authorization", bearer(2L)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.followedByMe").value(true))
                .andExpect(jsonPath("$.followerCount").value(35));
    }

    @Test
    void unfollow_最新のフォロワー数を返す() throws Exception {
        when(followService.unfollow(2L, "taro")).thenReturn(new FollowResponse(false, 34));

        mockMvc.perform(delete("/api/users/taro/follow").header("Authorization", bearer(2L)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.followedByMe").value(false))
                .andExpect(jsonPath("$.followerCount").value(34));
    }

    @Test
    void follow_自分自身は400() throws Exception {
        when(followService.follow(2L, "hanako"))
                .thenThrow(new ApiException(HttpStatus.BAD_REQUEST, "自分自身はフォローできません"));

        mockMvc.perform(post("/api/users/hanako/follow").header("Authorization", bearer(2L)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("自分自身はフォローできません"));
    }

    @Test
    void follow_JWTが無ければ401() throws Exception {
        mockMvc.perform(post("/api/users/taro/follow")).andExpect(status().isUnauthorized());
        verifyNoInteractions(followService);
    }

    @Test
    void following_ページング付きのユーザー一覧を返す() throws Exception {
        UserSummary hanako = new UserSummary(2L, "hanako", "花子", null, "Javaを勉強中です", true, false);
        when(followService.following(2L, "taro", 50L)).thenReturn(new PageResponse<>(List.of(hanako), 41L, true));

        mockMvc.perform(get("/api/users/taro/following").param("cursor", "50").header("Authorization", bearer(2L)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].username").value("hanako"))
                .andExpect(jsonPath("$.items[0].bio").value("Javaを勉強中です"))
                .andExpect(jsonPath("$.items[0].followedByMe").value(true))
                .andExpect(jsonPath("$.items[0].isMe").value(false))
                .andExpect(jsonPath("$.nextCursor").value(41))
                .andExpect(jsonPath("$.hasNext").value(true));
    }

    @Test
    void followers_存在しないユーザーは404() throws Exception {
        when(followService.followers(2L, "nobody", null))
                .thenThrow(new ApiException(HttpStatus.NOT_FOUND, "このアカウントは存在しません"));

        mockMvc.perform(get("/api/users/nobody/followers").header("Authorization", bearer(2L)))
                .andExpect(status().isNotFound());
    }
}
