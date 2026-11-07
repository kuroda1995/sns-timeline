package com.example.snstimeline.controller;

import com.example.snstimeline.config.ApiTags;
import com.example.snstimeline.dto.NewPostsResponse;
import com.example.snstimeline.dto.PageResponse;
import com.example.snstimeline.dto.PostResponse;
import com.example.snstimeline.service.PostQueryService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = ApiTags.TIMELINE)
@RestController
@RequestMapping("/api/timeline")
public class TimelineController {

    private final PostQueryService postQueryService;

    public TimelineController(PostQueryService postQueryService) {
        this.postQueryService = postQueryService;
    }

    /** T-01 タイムライン。2ページ目以降は前回の nextCursor を cursor に渡す */
    @Operation(summary = "T-01 タイムライン", description = "フォロー中のユーザーと自分の投稿を新しい順に最大20件返す")
    @GetMapping
    public PageResponse<PostResponse> timeline(@AuthenticationPrincipal Jwt jwt,
            @Parameter(description = "前回のレスポンスの nextCursor。省略すると最新から取得する")
            @RequestParam(required = false) Long cursor) {
        return postQueryService.timeline(Long.valueOf(jwt.getSubject()), cursor);
    }

    /** T-02 新着投稿。since(画面に表示中で一番新しい投稿ID)より新しい投稿を返す */
    @Operation(summary = "T-02 新着投稿の確認", description = """
            since より新しい投稿を新しい順に最大20件返す。
            hasMore が true のときは20件より多く溜まっているため、画面はタイムラインを読み込み直す。""")
    @ApiResponse(responseCode = "200", description = "成功")
    @ApiResponse(responseCode = "400", description = "since が無い、数値でない")
    @GetMapping("/new")
    public NewPostsResponse newPosts(@AuthenticationPrincipal Jwt jwt,
            @Parameter(description = "画面がサーバーから受け取った中で一番新しい投稿ID(0件のときは 0)")
            @RequestParam long since) {
        return postQueryService.newPosts(Long.valueOf(jwt.getSubject()), since);
    }
}
