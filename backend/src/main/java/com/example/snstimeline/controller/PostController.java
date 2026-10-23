package com.example.snstimeline.controller;

import com.example.snstimeline.dto.PostResponse;
import com.example.snstimeline.dto.UpdatePostRequest;
import com.example.snstimeline.service.PostService;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/posts")
public class PostController {

    private final PostService postService;

    public PostController(PostService postService) {
        this.postService = postService;
    }

    /**
     * P-01 投稿作成。画像を添付できるよう multipart/form-data で受け取る(画像は画像投稿機能で対応する)
     */
    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public PostResponse create(@AuthenticationPrincipal Jwt jwt,
            @RequestParam(name = "content", required = false) String content) {
        return postService.create(userId(jwt), content);
    }

    /** P-02 投稿詳細 */
    @GetMapping("/{postId}")
    public PostResponse get(@AuthenticationPrincipal Jwt jwt, @PathVariable Long postId) {
        return postService.get(userId(jwt), postId);
    }

    /** P-04 投稿編集 */
    @PutMapping("/{postId}")
    public PostResponse update(@AuthenticationPrincipal Jwt jwt, @PathVariable Long postId,
            @RequestBody UpdatePostRequest request) {
        return postService.update(userId(jwt), postId, request.content());
    }

    /** P-03 投稿削除 */
    @DeleteMapping("/{postId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal Jwt jwt, @PathVariable Long postId) {
        postService.delete(userId(jwt), postId);
    }

    private static Long userId(Jwt jwt) {
        return Long.valueOf(jwt.getSubject());
    }
}
