package com.example.snstimeline.controller;

import com.example.snstimeline.config.ApiTags;
import com.example.snstimeline.dto.PostResponse;
import com.example.snstimeline.dto.UpdatePostRequest;
import com.example.snstimeline.service.PostService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.List;
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
import org.springframework.web.multipart.MultipartFile;

@Tag(name = ApiTags.POST)
@RestController
@RequestMapping("/api/posts")
public class PostController {

    private final PostService postService;

    public PostController(PostService postService) {
        this.postService = postService;
    }

    /**
     * P-01 投稿作成。multipart/form-data で本文(content)と画像(images、同じ名前で最大4つ)を受け取る。
     * 送った順が画像の表示順になる
     */
    @Operation(operationId = "createPost", summary = "P-01 投稿作成", description = "画像が無い場合も multipart/form-data で送る")
    @ApiResponse(responseCode = "201", description = "投稿成功")
    @ApiResponse(responseCode = "400",
            description = "本文が141文字以上、本文も画像も無い、画像が5枚以上、対応していない画像の形式(中身で判定)")
    @ApiResponse(responseCode = "413", description = "画像が1枚5MB超、合計20MB超")
    @ApiResponse(responseCode = "415", description = "multipart/form-data 以外(JSONなど)で送った")
    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public PostResponse create(@AuthenticationPrincipal Jwt jwt,
            @Parameter(description = "本文(0〜140文字)。画像が無い場合は必須")
            @RequestParam(name = "content", required = false) String content,
            @Parameter(description = "画像ファイル(JPEG・PNG・GIF・WebP、1枚5MBまで)。同じ名前で最大4つ。送った順が表示順になる")
            @RequestParam(name = "images", required = false) List<MultipartFile> images) {
        return postService.create(userId(jwt), content, images);
    }

    /** P-02 投稿詳細 */
    @Operation(operationId = "getPost", summary = "P-02 投稿詳細")
    @ApiResponse(responseCode = "200", description = "取得成功")
    @ApiResponse(responseCode = "400", description = "postId が数値でない")
    @ApiResponse(responseCode = "404", description = "存在しない、または削除済み")
    @GetMapping("/{postId}")
    public PostResponse get(@AuthenticationPrincipal Jwt jwt, @PathVariable Long postId) {
        return postService.get(userId(jwt), postId);
    }

    /** P-04 投稿編集 */
    @Operation(operationId = "updatePost", summary = "P-04 投稿編集(本人のみ)", description = "編集すると edited が true になる")
    @ApiResponse(responseCode = "200", description = "編集成功")
    @ApiResponse(responseCode = "400", description = "本文が空、または141文字以上")
    @ApiResponse(responseCode = "403", description = "自分の投稿ではない")
    @ApiResponse(responseCode = "404", description = "存在しない、または削除済み")
    @PutMapping("/{postId}")
    public PostResponse update(@AuthenticationPrincipal Jwt jwt, @PathVariable Long postId,
            @RequestBody UpdatePostRequest request) {
        return postService.update(userId(jwt), postId, request.content());
    }

    /** P-03 投稿削除 */
    @Operation(operationId = "deletePost", summary = "P-03 投稿削除(本人のみ)")
    @ApiResponse(responseCode = "204", description = "削除成功")
    @ApiResponse(responseCode = "403", description = "自分の投稿ではない")
    @ApiResponse(responseCode = "404", description = "存在しない、または削除済み")
    @DeleteMapping("/{postId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal Jwt jwt, @PathVariable Long postId) {
        postService.delete(userId(jwt), postId);
    }

    private static Long userId(Jwt jwt) {
        return Long.valueOf(jwt.getSubject());
    }
}
