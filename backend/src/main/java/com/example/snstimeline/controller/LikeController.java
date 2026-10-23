package com.example.snstimeline.controller;

import com.example.snstimeline.dto.LikeResponse;
import com.example.snstimeline.service.LikeService;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/posts/{postId}/likes")
public class LikeController {

    private final LikeService likeService;

    public LikeController(LikeService likeService) {
        this.likeService = likeService;
    }

    /** L-01 いいねする */
    @PostMapping
    public LikeResponse like(@AuthenticationPrincipal Jwt jwt, @PathVariable Long postId) {
        return likeService.like(Long.valueOf(jwt.getSubject()), postId);
    }

    /** L-02 いいね取り消し */
    @DeleteMapping
    public LikeResponse unlike(@AuthenticationPrincipal Jwt jwt, @PathVariable Long postId) {
        return likeService.unlike(Long.valueOf(jwt.getSubject()), postId);
    }
}
