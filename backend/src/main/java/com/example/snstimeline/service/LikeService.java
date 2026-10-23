package com.example.snstimeline.service;

import com.example.snstimeline.dto.LikeResponse;
import com.example.snstimeline.exception.ApiException;
import com.example.snstimeline.repository.LikeRepository;
import com.example.snstimeline.repository.PostRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** いいね・取り消し(いいね機能 LIKE-01・02) */
@Service
public class LikeService {

    private final LikeRepository likeRepository;
    private final PostRepository postRepository;

    public LikeService(LikeRepository likeRepository, PostRepository postRepository) {
        this.likeRepository = likeRepository;
        this.postRepository = postRepository;
    }

    /** L-01 いいねする。既にいいね済みでも成功として扱う */
    @Transactional
    public LikeResponse like(Long me, Long postId) {
        ensureVisible(postId);
        likeRepository.insertIfAbsent(me, postId);
        return new LikeResponse(likeRepository.countByPostId(postId), true);
    }

    /** L-02 いいね取り消し。いいねしていなくても成功として扱う */
    @Transactional
    public LikeResponse unlike(Long me, Long postId) {
        ensureVisible(postId);
        likeRepository.deleteByUserIdAndPostId(me, postId);
        return new LikeResponse(likeRepository.countByPostId(postId), false);
    }

    /** 削除済みの投稿にはいいねできない(処理のルール No.5) */
    private void ensureVisible(Long postId) {
        if (!postRepository.existsByIdAndDeletedAtIsNull(postId)) {
            throw new ApiException(HttpStatus.NOT_FOUND, PostService.NOT_FOUND_MESSAGE);
        }
    }
}
