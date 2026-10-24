package com.example.snstimeline.repository;

import com.example.snstimeline.entity.PostImage;
import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PostImageRepository extends JpaRepository<PostImage, Long> {

    /** 投稿IDをまとめて渡し、画像を表示順に取得する(N+1問題の回避、設計書 3-2) */
    @Query("select i from PostImage i where i.post.id in :postIds order by i.post.id, i.sortOrder")
    List<PostImage> findByPostIds(@Param("postIds") Collection<Long> postIds);

    boolean existsByPostId(Long postId);
}
