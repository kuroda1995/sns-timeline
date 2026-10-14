package com.example.snstimeline.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.example.snstimeline.config.CorsConfig;
import com.example.snstimeline.config.JwtConfig;
import com.example.snstimeline.config.SecurityConfig;
import com.example.snstimeline.dto.AuthResponse;
import com.example.snstimeline.dto.UserResponse;
import com.example.snstimeline.entity.User;
import com.example.snstimeline.exception.ApiException;
import com.example.snstimeline.service.AuthService;
import com.example.snstimeline.service.JwtService;
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

@WebMvcTest(AuthController.class)
@Import({SecurityConfig.class, CorsConfig.class, JwtConfig.class, JwtService.class})
@TestPropertySource(properties = "app.jwt.secret=test-secret-key-that-is-at-least-32-bytes-long")
class AuthControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JwtService jwtService;

    @MockitoBean
    private AuthService authService;

    private static final UserResponse HANAKO = new UserResponse(2L, "hanako", "花子", null, "");

    private String tokenFor(long userId) {
        User user = new User("hanako", "hanako@example.com", "hash", "花子");
        ReflectionTestUtils.setField(user, "id", userId);
        return jwtService.issue(user);
    }

    @Test
    void signup_成功すると201でトークンとユーザーを返す() throws Exception {
        when(authService.signup(any())).thenReturn(new AuthResponse("token", HANAKO));

        mockMvc.perform(post("/api/auth/signup").contentType(MediaType.APPLICATION_JSON).content("""
                        {"username":"hanako","displayName":"花子","email":"hanako@example.com","password":"password123"}
                        """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.token").value("token"))
                .andExpect(jsonPath("$.user.username").value("hanako"));
    }

    @Test
    void signup_入力チェックエラーは400で項目ごとのエラーを返す() throws Exception {
        mockMvc.perform(post("/api/auth/signup").contentType(MediaType.APPLICATION_JSON).content("""
                        {"username":"a!","displayName":"","email":"not-email","password":"short"}
                        """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.message").value("入力内容に誤りがあります"))
                .andExpect(jsonPath("$.errors[?(@.field == 'username')]").exists())
                .andExpect(jsonPath("$.errors[?(@.field == 'displayName')]").exists())
                .andExpect(jsonPath("$.errors[?(@.field == 'email')]").exists())
                .andExpect(jsonPath("$.errors[?(@.field == 'password')]").exists());
    }

    @Test
    void signup_重複は409() throws Exception {
        when(authService.signup(any()))
                .thenThrow(new ApiException(HttpStatus.CONFLICT, "このユーザー名は既に使われています", "username"));

        mockMvc.perform(post("/api/auth/signup").contentType(MediaType.APPLICATION_JSON).content("""
                        {"username":"hanako","displayName":"花子","email":"hanako@example.com","password":"password123"}
                        """))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.errors[0].field").value("username"));
    }

    @Test
    void login_失敗は401() throws Exception {
        when(authService.login(any()))
                .thenThrow(new ApiException(HttpStatus.UNAUTHORIZED, "メールアドレスまたはパスワードが正しくありません"));

        mockMvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON).content("""
                        {"email":"hanako@example.com","password":"wrong"}
                        """))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value("メールアドレスまたはパスワードが正しくありません"));
    }

    @Test
    void me_有効なJWTならユーザー情報を返す() throws Exception {
        when(authService.me(2L)).thenReturn(HANAKO);

        mockMvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + tokenFor(2L)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.username").value("hanako"));
    }

    @Test
    void me_JWTが無ければ401のJSONを返す() throws Exception {
        mockMvc.perform(get("/api/auth/me"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.status").value(401))
                .andExpect(jsonPath("$.message").value("ログインしてください"));
    }

    @Test
    void me_JWTを1文字書き換えると401() throws Exception {
        String token = tokenFor(2L);
        int last = token.length() - 2;
        char replaced = token.charAt(last) == 'A' ? 'B' : 'A';
        String tampered = token.substring(0, last) + replaced + token.substring(last + 1);

        mockMvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + tampered))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void 認証が必要なAPIはJWTが無ければ401() throws Exception {
        mockMvc.perform(get("/api/timeline"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void CORS_フロントエンドのオリジンからのプリフライトを許可する() throws Exception {
        mockMvc.perform(options("/api/auth/login")
                        .header("Origin", "http://localhost:5173")
                        .header("Access-Control-Request-Method", "POST"))
                .andExpect(status().isOk())
                .andExpect(header().string("Access-Control-Allow-Origin", "http://localhost:5173"));
    }

    @Test
    void CORS_別のオリジンからのプリフライトは拒否する() throws Exception {
        mockMvc.perform(options("/api/auth/login")
                        .header("Origin", "http://localhost:5174")
                        .header("Access-Control-Request-Method", "POST"))
                .andExpect(status().isForbidden());
    }
}
