package com.example.snstimeline.controller;

import com.example.snstimeline.config.ApiTags;
import com.example.snstimeline.dto.AuthResponse;
import com.example.snstimeline.dto.LoginRequest;
import com.example.snstimeline.dto.SignupRequest;
import com.example.snstimeline.dto.UserResponse;
import com.example.snstimeline.service.AuthService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirements;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = ApiTags.AUTH)
@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    /** A-01 新規登録 */
    @Operation(summary = "A-01 新規登録", description = "登録に成功するとJWTを返し、そのままログイン状態になる")
    @SecurityRequirements
    @ApiResponse(responseCode = "201", description = "登録成功")
    @ApiResponse(responseCode = "400", description = "入力チェックエラー、予約語のユーザー名")
    @ApiResponse(responseCode = "409", description = "ユーザー名・メールアドレスが既に使われている")
    @PostMapping("/signup")
    @ResponseStatus(HttpStatus.CREATED)
    public AuthResponse signup(@Valid @RequestBody SignupRequest request) {
        return authService.signup(request);
    }

    /** A-02 ログイン */
    @Operation(summary = "A-02 ログイン")
    @SecurityRequirements
    @ApiResponse(responseCode = "200", description = "ログイン成功")
    @ApiResponse(responseCode = "400", description = "入力チェックエラー")
    @ApiResponse(responseCode = "401", description = "メールアドレスが無い、またはパスワードが違う(どちらかは区別しない)")
    @PostMapping("/login")
    public AuthResponse login(@Valid @RequestBody LoginRequest request) {
        return authService.login(request);
    }

    /** A-03 ログイン中のユーザー情報 */
    @Operation(summary = "A-03 ログイン中のユーザー情報")
    @GetMapping("/me")
    public UserResponse me(@AuthenticationPrincipal Jwt jwt) {
        return authService.me(Long.valueOf(jwt.getSubject()));
    }
}
