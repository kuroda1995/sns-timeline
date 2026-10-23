package com.example.snstimeline.service;

import com.example.snstimeline.dto.PostResponse;
import com.example.snstimeline.entity.Post;
import com.example.snstimeline.entity.User;
import com.example.snstimeline.exception.ApiException;
import com.example.snstimeline.repository.PostRepository;
import com.example.snstimeline.repository.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 投稿の作成・取得・編集・削除(投稿機能 PST-01〜04) */
@Service
public class PostService {

    static final String NOT_FOUND_MESSAGE = "この投稿は削除されたか、存在しません";

    private final PostRepository postRepository;
    private final UserRepository userRepository;
    private final PostQueryService postQueryService;

    public PostService(PostRepository postRepository, UserRepository userRepository,
            PostQueryService postQueryService) {
        this.postRepository = postRepository;
        this.userRepository = userRepository;
        this.postQueryService = postQueryService;
    }

    /** P-01 投稿作成 */
    @Transactional
    public PostResponse create(Long me, String content) {
        String normalized = ContentRules.normalize(content);
        User author = userRepository.findById(me)
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "ログインしてください"));
        Post post = postRepository.saveAndFlush(new Post(author, normalized));
        return postQueryService.toResponse(post, me);
    }

    /** P-02 投稿詳細 */
    @Transactional(readOnly = true)
    public PostResponse get(Long me, Long postId) {
        return postQueryService.toResponse(findVisible(postId), me);
    }

    /** P-04 投稿編集(本人のみ) */
    @Transactional
    public PostResponse update(Long me, Long postId, String content) {
        String normalized = ContentRules.normalize(content);
        Post post = findOwnPost(me, postId, "この投稿は編集できません");
        post.edit(normalized);
        postRepository.flush();
        return postQueryService.toResponse(post, me);
    }

    /** P-03 投稿削除(本人のみ・論理削除) */
    @Transactional
    public void delete(Long me, Long postId) {
        findOwnPost(me, postId, "この投稿は削除できません").delete();
    }

    private Post findVisible(Long postId) {
        return postRepository.findVisibleById(postId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, NOT_FOUND_MESSAGE));
    }

    /** 画面のボタンを隠すだけでなく、サーバー側で本人の投稿か確認する(処理のルール No.5) */
    private Post findOwnPost(Long me, Long postId, String forbiddenMessage) {
        Post post = findVisible(postId);
        if (!post.isWrittenBy(me)) {
            throw new ApiException(HttpStatus.FORBIDDEN, forbiddenMessage);
        }
        return post;
    }
}
