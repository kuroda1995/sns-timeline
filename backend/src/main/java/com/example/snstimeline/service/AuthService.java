package com.example.snstimeline.service;

import com.example.snstimeline.dto.AuthResponse;
import com.example.snstimeline.dto.LoginRequest;
import com.example.snstimeline.dto.SignupRequest;
import com.example.snstimeline.dto.UserResponse;
import com.example.snstimeline.entity.User;
import com.example.snstimeline.exception.ApiException;
import com.example.snstimeline.repository.UserRepository;
import com.example.snstimeline.service.storage.ImageStorage;
import java.util.Locale;
import java.util.Set;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 新規登録・ログイン・ログイン中ユーザーの取得(認証機能 AUTH-01〜05) */
@Service
public class AuthService {

    /** URL(/users/search など)と区別できなくなるため、ユーザー名として使えない語 */
    static final Set<String> RESERVED_USERNAMES =
            Set.of("search", "new", "me", "admin", "settings", "login", "signup");

    static final String LOGIN_FAILED_MESSAGE = "メールアドレスまたはパスワードが正しくありません";

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final ImageStorage imageStorage;
    /** 存在しないメールアドレスでも照合処理を行い、応答時間から登録有無を推測されないようにするためのハッシュ */
    private final String dummyPasswordHash;

    public AuthService(UserRepository userRepository, PasswordEncoder passwordEncoder, JwtService jwtService,
            ImageStorage imageStorage) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.imageStorage = imageStorage;
        this.dummyPasswordHash = passwordEncoder.encode("dummy-password-for-timing-1");
    }

    @Transactional
    public AuthResponse signup(SignupRequest request) {
        String username = request.username();
        if (RESERVED_USERNAMES.contains(username.toLowerCase(Locale.ROOT))) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "このユーザー名は使用できません", "username");
        }
        if (userRepository.existsByUsernameIgnoreCase(username)) {
            throw usernameTaken();
        }
        if (userRepository.existsByEmail(request.email())) {
            throw emailTaken();
        }

        User user = new User(username, request.email(), passwordEncoder.encode(request.password()),
                request.displayName());
        try {
            // 同時に同じユーザー名で登録された場合は、DBの一意インデックスで弾かれる
            user = userRepository.saveAndFlush(user);
        } catch (DataIntegrityViolationException e) {
            throw new ApiException(HttpStatus.CONFLICT, "ユーザー名またはメールアドレスは既に使われています");
        }
        return new AuthResponse(jwtService.issue(user), UserResponse.from(user, imageStorage));
    }

    @Transactional(readOnly = true)
    public AuthResponse login(LoginRequest request) {
        User user = userRepository.findByEmail(request.email()).orElse(null);
        String hash = user != null ? user.getPasswordHash() : dummyPasswordHash;
        boolean matches = passwordEncoder.matches(request.password(), hash);
        if (user == null || !matches) {
            // どちらが間違っているかは伝えない
            throw new ApiException(HttpStatus.UNAUTHORIZED, LOGIN_FAILED_MESSAGE);
        }
        return new AuthResponse(jwtService.issue(user), UserResponse.from(user, imageStorage));
    }

    @Transactional(readOnly = true)
    public UserResponse me(Long userId) {
        return userRepository.findById(userId)
                .map(user -> UserResponse.from(user, imageStorage))
                // トークンは有効でもユーザーが存在しない場合は、ログインし直してもらう
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "ログインしてください"));
    }

    private static ApiException usernameTaken() {
        return new ApiException(HttpStatus.CONFLICT, "このユーザー名は既に使われています", "username");
    }

    private static ApiException emailTaken() {
        return new ApiException(HttpStatus.CONFLICT, "このメールアドレスは既に登録されています", "email");
    }
}
