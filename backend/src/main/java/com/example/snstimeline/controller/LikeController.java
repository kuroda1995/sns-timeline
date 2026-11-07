package com.example.snstimeline.controller;

import com.example.snstimeline.config.ApiTags;
import com.example.snstimeline.dto.LikeResponse;
import com.example.snstimeline.service.LikeService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = ApiTags.LIKE)
@RestController
@RequestMapping("/api/posts/{postId}/likes")
public class LikeController {

    private final LikeService likeService;

    public LikeController(LikeService likeService) {
        this.likeService = likeService;
    }

    /** L-01 いいねする */
    @Operation(summary = "L-01 いいねする", description = "既にいいね済みでも成功する。likeCount は他の人のいいねも含めた最新の数")
    @ApiResponse(responseCode = "200", description = "成功")
    @ApiResponse(responseCode = "404", description = "投稿が存在しない、または削除済み")
    @PostMapping
    public LikeResponse like(@AuthenticationPrincipal Jwt jwt, @PathVariable Long postId) {
        return likeService.like(Long.valueOf(jwt.getSubject()), postId);
    }

    /** L-02 いいね取り消し */
    @Operation(summary = "L-02 いいね取り消し", description = "いいねしていなくても成功する")
    @ApiResponse(responseCode = "200", description = "成功")
    @ApiResponse(responseCode = "404", description = "投稿が存在しない、または削除済み")
    @DeleteMapping
    public LikeResponse unlike(@AuthenticationPrincipal Jwt jwt, @PathVariable Long postId) {
        return likeService.unlike(Long.valueOf(jwt.getSubject()), postId);
    }
}
