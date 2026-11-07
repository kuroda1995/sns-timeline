package com.example.snstimeline.controller;

import com.example.snstimeline.config.ApiTags;
import com.example.snstimeline.dto.FollowResponse;
import com.example.snstimeline.dto.PageResponse;
import com.example.snstimeline.dto.UserSummary;
import com.example.snstimeline.service.FollowService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** フォローのAPI。相手はユーザーIDではなくユーザー名で指定する(画面のURL /users/taro とそろえる、処理のルール No.7) */
@Tag(name = ApiTags.FOLLOW)
@RestController
@RequestMapping("/api/users/{username}")
public class FollowController {

    private final FollowService followService;

    public FollowController(FollowService followService) {
        this.followService = followService;
    }

    /** F-01 フォローする */
    @Operation(summary = "F-01 フォローする",
            description = "既にフォロー済みでも成功する。followerCount は相手の最新のフォロワー数")
    @ApiResponse(responseCode = "200", description = "成功")
    @ApiResponse(responseCode = "400", description = "自分自身を指定した")
    @ApiResponse(responseCode = "404", description = "ユーザーが存在しない")
    @PostMapping("/follow")
    public FollowResponse follow(@AuthenticationPrincipal Jwt jwt, @PathVariable String username) {
        return followService.follow(userId(jwt), username);
    }

    /** F-02 フォロー解除 */
    @Operation(summary = "F-02 フォロー解除", description = "フォローしていなくても成功する")
    @ApiResponse(responseCode = "200", description = "成功")
    @ApiResponse(responseCode = "400", description = "自分自身を指定した")
    @ApiResponse(responseCode = "404", description = "ユーザーが存在しない")
    @DeleteMapping("/follow")
    public FollowResponse unfollow(@AuthenticationPrincipal Jwt jwt, @PathVariable String username) {
        return followService.unfollow(userId(jwt), username);
    }

    /** F-03 フォロー中の一覧。2ページ目以降は前回の nextCursor を cursor に渡す */
    @Operation(summary = "F-03 フォロー中の一覧",
            description = "followedByMe は「ログイン中のユーザーが、その行の人をフォローしているか」")
    @ApiResponse(responseCode = "200", description = "成功")
    @ApiResponse(responseCode = "404", description = "ユーザーが存在しない")
    @GetMapping("/following")
    public PageResponse<UserSummary> following(@AuthenticationPrincipal Jwt jwt, @PathVariable String username,
            @Parameter(description = "前回のレスポンスの nextCursor。省略すると最初から取得する")
            @RequestParam(required = false) Long cursor) {
        return followService.following(userId(jwt), username, cursor);
    }

    /** F-04 フォロワーの一覧 */
    @Operation(summary = "F-04 フォロワーの一覧",
            description = "followedByMe は「ログイン中のユーザーが、その行の人をフォローしているか」")
    @ApiResponse(responseCode = "200", description = "成功")
    @ApiResponse(responseCode = "404", description = "ユーザーが存在しない")
    @GetMapping("/followers")
    public PageResponse<UserSummary> followers(@AuthenticationPrincipal Jwt jwt, @PathVariable String username,
            @Parameter(description = "前回のレスポンスの nextCursor。省略すると最初から取得する")
            @RequestParam(required = false) Long cursor) {
        return followService.followers(userId(jwt), username, cursor);
    }

    private static Long userId(Jwt jwt) {
        return Long.valueOf(jwt.getSubject());
    }
}
