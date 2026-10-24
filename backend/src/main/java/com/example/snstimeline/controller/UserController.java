package com.example.snstimeline.controller;

import com.example.snstimeline.dto.AvatarResponse;
import com.example.snstimeline.dto.PageResponse;
import com.example.snstimeline.dto.PostResponse;
import com.example.snstimeline.dto.ProfileResponse;
import com.example.snstimeline.dto.UpdateProfileRequest;
import com.example.snstimeline.dto.UserListResponse;
import com.example.snstimeline.dto.UserSearchResponse;
import com.example.snstimeline.service.UserSearchService;
import com.example.snstimeline.service.UserService;
import org.springframework.http.MediaType;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

/**
 * ユーザー(検索・プロフィール)のAPI。/api/users/search・new・me はユーザー名に使えない予約語のため、
 * /api/users/{username} と区別できる(設計書 4-2)。
 */
@RestController
@RequestMapping("/api/users")
public class UserController {

    private final UserService userService;
    private final UserSearchService userSearchService;

    public UserController(UserService userService, UserSearchService userSearchService) {
        this.userService = userService;
        this.userSearchService = userSearchService;
    }

    /** U-01 ユーザー検索。q の先頭が @ ならユーザー名だけを検索する。page は0始まり */
    @GetMapping("/search")
    public UserSearchResponse search(@AuthenticationPrincipal Jwt jwt,
            @RequestParam(required = false) String q, @RequestParam(defaultValue = "0") int page) {
        return userSearchService.search(userId(jwt), q, page);
    }

    /** U-02 新しく参加したユーザー */
    @GetMapping("/new")
    public UserListResponse newUsers(@AuthenticationPrincipal Jwt jwt) {
        return userSearchService.newUsers(userId(jwt));
    }

    /** U-03 プロフィール */
    @GetMapping("/{username}")
    public ProfileResponse profile(@AuthenticationPrincipal Jwt jwt, @PathVariable String username) {
        return userService.profile(userId(jwt), username);
    }

    /** U-04 ユーザーの投稿一覧。2ページ目以降は前回の nextCursor を cursor に渡す */
    @GetMapping("/{username}/posts")
    public PageResponse<PostResponse> posts(@AuthenticationPrincipal Jwt jwt, @PathVariable String username,
            @RequestParam(required = false) Long cursor) {
        return userService.posts(userId(jwt), username, cursor);
    }

    /** U-05 プロフィール更新(ログイン中のユーザー自身のみ) */
    @PutMapping("/me")
    public ProfileResponse updateMe(@AuthenticationPrincipal Jwt jwt, @RequestBody UpdateProfileRequest request) {
        return userService.updateMe(userId(jwt), request);
    }

    /** U-06 アイコン画像の変更(ログイン中のユーザー自身のみ)。multipart/form-data のパート名 avatar に画像1枚 */
    @PostMapping(path = "/me/avatar", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public AvatarResponse changeAvatar(@AuthenticationPrincipal Jwt jwt,
            @RequestParam(name = "avatar", required = false) MultipartFile avatar) {
        return userService.changeAvatar(userId(jwt), avatar);
    }

    private static Long userId(Jwt jwt) {
        return Long.valueOf(jwt.getSubject());
    }
}
