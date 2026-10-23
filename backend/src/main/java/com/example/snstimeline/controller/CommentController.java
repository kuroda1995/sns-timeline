package com.example.snstimeline.controller;

import com.example.snstimeline.dto.CommentCountResponse;
import com.example.snstimeline.dto.CommentResponse;
import com.example.snstimeline.dto.CreateCommentRequest;
import com.example.snstimeline.dto.CreateCommentResponse;
import com.example.snstimeline.dto.PageResponse;
import com.example.snstimeline.service.CommentService;
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

@RestController
@RequestMapping("/api")
public class CommentController {

    private final CommentService commentService;

    public CommentController(CommentService commentService) {
        this.commentService = commentService;
    }

    /** C-01 コメント一覧。2ページ目以降は前回の nextCursor を cursor に渡す */
    @GetMapping("/posts/{postId}/comments")
    public PageResponse<CommentResponse> list(@AuthenticationPrincipal Jwt jwt, @PathVariable Long postId,
            @RequestParam(required = false) Long cursor) {
        return commentService.list(userId(jwt), postId, cursor);
    }

    /** C-02 コメント投稿 */
    @PostMapping("/posts/{postId}/comments")
    @ResponseStatus(HttpStatus.CREATED)
    public CreateCommentResponse create(@AuthenticationPrincipal Jwt jwt, @PathVariable Long postId,
            @RequestBody CreateCommentRequest request) {
        return commentService.create(userId(jwt), postId, request.content());
    }

    /** C-03 コメント削除 */
    @DeleteMapping("/comments/{commentId}")
    public CommentCountResponse delete(@AuthenticationPrincipal Jwt jwt, @PathVariable Long commentId) {
        return commentService.delete(userId(jwt), commentId);
    }

    private static Long userId(Jwt jwt) {
        return Long.valueOf(jwt.getSubject());
    }
}
