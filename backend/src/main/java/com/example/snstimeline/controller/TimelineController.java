package com.example.snstimeline.controller;

import com.example.snstimeline.dto.NewPostsResponse;
import com.example.snstimeline.dto.PageResponse;
import com.example.snstimeline.dto.PostResponse;
import com.example.snstimeline.service.PostQueryService;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/timeline")
public class TimelineController {

    private final PostQueryService postQueryService;

    public TimelineController(PostQueryService postQueryService) {
        this.postQueryService = postQueryService;
    }

    /** T-01 タイムライン。2ページ目以降は前回の nextCursor を cursor に渡す */
    @GetMapping
    public PageResponse<PostResponse> timeline(@AuthenticationPrincipal Jwt jwt,
            @RequestParam(required = false) Long cursor) {
        return postQueryService.timeline(Long.valueOf(jwt.getSubject()), cursor);
    }

    /** T-02 新着投稿。since(画面に表示中で一番新しい投稿ID)より新しい投稿を返す */
    @GetMapping("/new")
    public NewPostsResponse newPosts(@AuthenticationPrincipal Jwt jwt, @RequestParam long since) {
        return postQueryService.newPosts(Long.valueOf(jwt.getSubject()), since);
    }
}
