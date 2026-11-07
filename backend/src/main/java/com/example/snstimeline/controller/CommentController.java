package com.example.snstimeline.controller;

import com.example.snstimeline.config.ApiTags;
import com.example.snstimeline.dto.CommentCountResponse;
import com.example.snstimeline.dto.CommentResponse;
import com.example.snstimeline.dto.CreateCommentRequest;
import com.example.snstimeline.dto.CreateCommentResponse;
import com.example.snstimeline.dto.PageResponse;
import com.example.snstimeline.service.CommentService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = ApiTags.COMMENT)
@RestController
@RequestMapping("/api")
public class CommentController {

    private final CommentService commentService;

    public CommentController(CommentService commentService) {
        this.commentService = commentService;
    }

    /** C-01 コメント一覧。2ページ目以降は前回の nextCursor を cursor に渡す */
    @Operation(operationId = "listComments", summary = "C-01 コメント一覧", description = "古い順に返す")
    @ApiResponse(responseCode = "200", description = "成功")
    @ApiResponse(responseCode = "404", description = "投稿が存在しない、または削除済み")
    @GetMapping("/posts/{postId}/comments")
    public PageResponse<CommentResponse> list(@AuthenticationPrincipal Jwt jwt, @PathVariable Long postId,
            @Parameter(description = "前回のレスポンスの nextCursor。省略すると最初から取得する")
            @RequestParam(required = false) Long cursor) {
        return commentService.list(userId(jwt), postId, cursor);
    }

    /** C-02 コメント投稿 */
    @Operation(operationId = "createComment", summary = "C-02 コメント投稿",
            description = "commentCount は他の人のコメントも含めた最新の数")
    @ApiResponse(responseCode = "201", description = "成功")
    @ApiResponse(responseCode = "400", description = "空、141文字以上")
    @ApiResponse(responseCode = "404", description = "投稿が存在しない、または削除済み")
    @PostMapping("/posts/{postId}/comments")
    @ResponseStatus(HttpStatus.CREATED)
    public CreateCommentResponse create(@AuthenticationPrincipal Jwt jwt, @PathVariable Long postId,
            @RequestBody CreateCommentRequest request) {
        return commentService.create(userId(jwt), postId, request.content());
    }

    /** C-03 コメント削除 */
    @Operation(operationId = "deleteComment", summary = "C-03 コメント削除(本人のみ)",
            description = "削除後の最新のコメント数を返す")
    @ApiResponse(responseCode = "200", description = "成功")
    @ApiResponse(responseCode = "403", description = "自分のコメントではない")
    @ApiResponse(responseCode = "404", description = "存在しない、または削除済み")
    @DeleteMapping("/comments/{commentId}")
    public CommentCountResponse delete(@AuthenticationPrincipal Jwt jwt, @PathVariable Long commentId) {
        return commentService.delete(userId(jwt), commentId);
    }

    private static Long userId(Jwt jwt) {
        return Long.valueOf(jwt.getSubject());
    }
}
