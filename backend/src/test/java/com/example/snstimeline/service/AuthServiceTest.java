package com.example.snstimeline.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.example.snstimeline.service.storage.ImageStorage;
import com.example.snstimeline.dto.AuthResponse;
import com.example.snstimeline.dto.LoginRequest;
import com.example.snstimeline.dto.SignupRequest;
import com.example.snstimeline.entity.User;
import com.example.snstimeline.exception.ApiException;
import com.example.snstimeline.repository.UserRepository;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

class AuthServiceTest {

    private UserRepository userRepository;
    private JwtService jwtService;
    private PasswordEncoder passwordEncoder;
    private AuthService authService;

    @BeforeEach
    void setUp() {
        userRepository = mock(UserRepository.class);
        jwtService = mock(JwtService.class);
        // テストを速くするため強度を下げる
        passwordEncoder = new BCryptPasswordEncoder(4);
        authService = new AuthService(userRepository, passwordEncoder, jwtService, mock(ImageStorage.class));
        when(jwtService.issue(any())).thenReturn("token");
    }

    private static SignupRequest signupRequest(String username) {
        return new SignupRequest(username, "花子", "hanako@example.com", "password123");
    }

    @Test
    void signup_パスワードはBCryptでハッシュ化して保存し元の値は保存しない() {
        when(userRepository.saveAndFlush(any())).thenAnswer(inv -> inv.getArgument(0));

        AuthResponse response = authService.signup(signupRequest("hanako"));

        ArgumentCaptor<User> captor = ArgumentCaptor.forClass(User.class);
        verify(userRepository).saveAndFlush(captor.capture());
        User saved = captor.getValue();
        assertThat(saved.getPasswordHash()).isNotEqualTo("password123").startsWith("$2");
        assertThat(passwordEncoder.matches("password123", saved.getPasswordHash())).isTrue();
        assertThat(response.token()).isEqualTo("token");
        assertThat(response.user().username()).isEqualTo("hanako");
    }

    @Test
    void signup_予約語のユーザー名は大文字小文字に関係なく400() {
        assertThatThrownBy(() -> authService.signup(signupRequest("Admin")))
                .isInstanceOfSatisfying(ApiException.class, e -> {
                    assertThat(e.getStatus()).isEqualTo(HttpStatus.BAD_REQUEST);
                    assertThat(e.getField()).isEqualTo("username");
                });
        verify(userRepository, never()).saveAndFlush(any());
    }

    @Test
    void signup_使われているユーザー名は409() {
        when(userRepository.existsByUsernameIgnoreCase("Hanako")).thenReturn(true);

        assertThatThrownBy(() -> authService.signup(signupRequest("Hanako")))
                .isInstanceOfSatisfying(ApiException.class, e -> {
                    assertThat(e.getStatus()).isEqualTo(HttpStatus.CONFLICT);
                    assertThat(e.getMessage()).isEqualTo("このユーザー名は既に使われています");
                });
    }

    @Test
    void signup_登録済みのメールアドレスは409() {
        when(userRepository.existsByEmail("hanako@example.com")).thenReturn(true);

        assertThatThrownBy(() -> authService.signup(signupRequest("hanako")))
                .isInstanceOfSatisfying(ApiException.class, e -> {
                    assertThat(e.getStatus()).isEqualTo(HttpStatus.CONFLICT);
                    assertThat(e.getField()).isEqualTo("email");
                });
    }

    @Test
    void signup_同時登録でDBの一意制約に違反したら409() {
        when(userRepository.saveAndFlush(any())).thenThrow(new DataIntegrityViolationException("dup"));

        assertThatThrownBy(() -> authService.signup(signupRequest("hanako")))
                .isInstanceOfSatisfying(ApiException.class,
                        e -> assertThat(e.getStatus()).isEqualTo(HttpStatus.CONFLICT));
    }

    @Test
    void login_正しいパスワードならトークンを返す() {
        User user = new User("hanako", "hanako@example.com", passwordEncoder.encode("password123"), "花子");
        when(userRepository.findByEmail("hanako@example.com")).thenReturn(Optional.of(user));

        AuthResponse response = authService.login(new LoginRequest(" Hanako@Example.com ", "password123"));

        assertThat(response.token()).isEqualTo("token");
    }

    @Test
    void login_パスワード違いとメールアドレス無しは同じ401メッセージ() {
        User user = new User("hanako", "hanako@example.com", passwordEncoder.encode("password123"), "花子");
        when(userRepository.findByEmail("hanako@example.com")).thenReturn(Optional.of(user));
        when(userRepository.findByEmail("nobody@example.com")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> authService.login(new LoginRequest("hanako@example.com", "wrong1234")))
                .isInstanceOfSatisfying(ApiException.class, e -> {
                    assertThat(e.getStatus()).isEqualTo(HttpStatus.UNAUTHORIZED);
                    assertThat(e.getMessage()).isEqualTo(AuthService.LOGIN_FAILED_MESSAGE);
                });
        assertThatThrownBy(() -> authService.login(new LoginRequest("nobody@example.com", "password123")))
                .isInstanceOfSatisfying(ApiException.class, e -> {
                    assertThat(e.getStatus()).isEqualTo(HttpStatus.UNAUTHORIZED);
                    assertThat(e.getMessage()).isEqualTo(AuthService.LOGIN_FAILED_MESSAGE);
                });
    }

    @Test
    void me_ユーザーが存在しなければ401() {
        when(userRepository.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> authService.me(99L))
                .isInstanceOfSatisfying(ApiException.class,
                        e -> assertThat(e.getStatus()).isEqualTo(HttpStatus.UNAUTHORIZED));
    }
}
