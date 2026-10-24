package com.example.snstimeline.controller;

import com.example.snstimeline.dto.FollowResponse;
import com.example.snstimeline.dto.PageResponse;
import com.example.snstimeline.dto.UserSummary;
import com.example.snstimeline.service.FollowService;
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
@RestController
@RequestMapping("/api/users/{username}")
public class FollowController {

    private final FollowService followService;

    public FollowController(FollowService followService) {
        this.followService = followService;
    }

    /** F-01 フォローする */
    @PostMapping("/follow")
    public FollowResponse follow(@AuthenticationPrincipal Jwt jwt, @PathVariable String username) {
        return followService.follow(userId(jwt), username);
    }

    /** F-02 フォロー解除 */
    @DeleteMapping("/follow")
    public FollowResponse unfollow(@AuthenticationPrincipal Jwt jwt, @PathVariable String username) {
        return followService.unfollow(userId(jwt), username);
    }

    /** F-03 フォロー中の一覧。2ページ目以降は前回の nextCursor を cursor に渡す */
    @GetMapping("/following")
    public PageResponse<UserSummary> following(@AuthenticationPrincipal Jwt jwt, @PathVariable String username,
            @RequestParam(required = false) Long cursor) {
        return followService.following(userId(jwt), username, cursor);
    }

    /** F-04 フォロワーの一覧 */
    @GetMapping("/followers")
    public PageResponse<UserSummary> followers(@AuthenticationPrincipal Jwt jwt, @PathVariable String username,
            @RequestParam(required = false) Long cursor) {
        return followService.followers(userId(jwt), username, cursor);
    }

    private static Long userId(Jwt jwt) {
        return Long.valueOf(jwt.getSubject());
    }
}
