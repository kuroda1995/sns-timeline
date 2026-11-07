package com.example.snstimeline.controller;

import com.example.snstimeline.config.ApiTags;
import com.example.snstimeline.dto.AvatarResponse;
import com.example.snstimeline.dto.PageResponse;
import com.example.snstimeline.dto.PostResponse;
import com.example.snstimeline.dto.ProfileResponse;
import com.example.snstimeline.dto.UpdateProfileRequest;
import com.example.snstimeline.dto.UserListResponse;
import com.example.snstimeline.dto.UserSearchResponse;
import com.example.snstimeline.service.UserSearchService;
import com.example.snstimeline.service.UserService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
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
 * API仕様書では、機能定義書に合わせて「ユーザー検索」と「プロフィール」のグループに分ける。
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
    @Tag(name = ApiTags.USER_SEARCH)
    @Operation(summary = "U-01 ユーザー検索", description = "完全一致を先頭に、1ページ20件返す")
    @ApiResponse(responseCode = "200", description = "成功(0件の場合は items が空の配列)")
    @ApiResponse(responseCode = "400", description = "q が無い、空、50文字を超える")
    @GetMapping("/search")
    public UserSearchResponse search(@AuthenticationPrincipal Jwt jwt,
            @Parameter(description = "キーワード(1〜50文字)。先頭が @ ならユーザー名だけを対象にする", required = true)
            @RequestParam(required = false) String q,
            @Parameter(description = "ページ番号(0始まり)") @RequestParam(defaultValue = "0") int page) {
        return userSearchService.search(userId(jwt), q, page);
    }

    /** U-02 新しく参加したユーザー */
    @Tag(name = ApiTags.USER_SEARCH)
    @Operation(summary = "U-02 新しく参加したユーザー", description = "登録が新しい順に20人を返す(自分は除く)")
    @GetMapping("/new")
    public UserListResponse newUsers(@AuthenticationPrincipal Jwt jwt) {
        return userSearchService.newUsers(userId(jwt));
    }

    /** U-03 プロフィール */
    @Tag(name = ApiTags.PROFILE)
    @Operation(summary = "U-03 プロフィール")
    @ApiResponse(responseCode = "200", description = "成功")
    @ApiResponse(responseCode = "404", description = "ユーザーが存在しない")
    @GetMapping("/{username}")
    public ProfileResponse profile(@AuthenticationPrincipal Jwt jwt, @PathVariable String username) {
        return userService.profile(userId(jwt), username);
    }

    /** U-04 ユーザーの投稿一覧。2ページ目以降は前回の nextCursor を cursor に渡す */
    @Tag(name = ApiTags.PROFILE)
    @Operation(summary = "U-04 ユーザーの投稿一覧", description = "タイムライン(T-01)と同じ形のページング付き一覧")
    @ApiResponse(responseCode = "200", description = "成功")
    @ApiResponse(responseCode = "404", description = "ユーザーが存在しない")
    @GetMapping("/{username}/posts")
    public PageResponse<PostResponse> posts(@AuthenticationPrincipal Jwt jwt, @PathVariable String username,
            @Parameter(description = "前回のレスポンスの nextCursor。省略すると最新から取得する")
            @RequestParam(required = false) Long cursor) {
        return userService.posts(userId(jwt), username, cursor);
    }

    /** U-05 プロフィール更新(ログイン中のユーザー自身のみ) */
    @Tag(name = ApiTags.PROFILE)
    @Operation(summary = "U-05 プロフィール更新", description = "ログイン中のユーザー自身のプロフィールを更新し、更新後のプロフィールを返す")
    @ApiResponse(responseCode = "200", description = "成功")
    @ApiResponse(responseCode = "400", description = "入力チェックエラー")
    @PutMapping("/me")
    public ProfileResponse updateMe(@AuthenticationPrincipal Jwt jwt, @RequestBody UpdateProfileRequest request) {
        return userService.updateMe(userId(jwt), request);
    }

    /** U-06 アイコン画像の変更(ログイン中のユーザー自身のみ)。multipart/form-data のパート名 avatar に画像1枚 */
    @Tag(name = ApiTags.PROFILE)
    @Operation(summary = "U-06 アイコン画像の変更", description = "形式・サイズのチェックは投稿画像(P-01)と同じ")
    @ApiResponse(responseCode = "200", description = "成功")
    @ApiResponse(responseCode = "400", description = "画像が無い、対応していない形式(中身で判定)")
    @ApiResponse(responseCode = "413", description = "5MB超")
    @PostMapping(path = "/me/avatar", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public AvatarResponse changeAvatar(@AuthenticationPrincipal Jwt jwt,
            @Parameter(description = "画像ファイル1枚(JPEG・PNG・GIF・WebP、5MBまで)", required = true)
            @RequestParam(name = "avatar", required = false) MultipartFile avatar) {
        return userService.changeAvatar(userId(jwt), avatar);
    }

    private static Long userId(Jwt jwt) {
        return Long.valueOf(jwt.getSubject());
    }
}
