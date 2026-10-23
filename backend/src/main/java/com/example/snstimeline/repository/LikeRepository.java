package com.example.snstimeline.repository;

import com.example.snstimeline.entity.PostLike;
import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface LikeRepository extends JpaRepository<PostLike, Long> {

    /**
     * L-01 いいねする。既にいいね済みなら何もしない(冪等、いいね機能 処理のルール No.1・2)。
     * 「確認してから登録」だと、連打で同時に届いた2つのリクエストが両方とも確認を通り、
     * 2件目が一意制約違反になる。重複の判定はDB(UNIQUE (user_id, post_id))に任せる。
     */
    @Modifying
    @Query(value = """
            insert into likes (user_id, post_id, created_at) values (:userId, :postId, now())
            on conflict (user_id, post_id) do nothing
            """, nativeQuery = true)
    int insertIfAbsent(@Param("userId") Long userId, @Param("postId") Long postId);

    /** L-02 いいね取り消し。いいねしていなければ何もしない(冪等) */
    @Modifying
    @Query("delete from PostLike l where l.user.id = :userId and l.post.id = :postId")
    int deleteByUserIdAndPostId(@Param("userId") Long userId, @Param("postId") Long postId);

    long countByPostId(Long postId);

    /** 投稿IDごとのいいね数をまとめて数える(設計書 3-2)。いいねが0件の投稿は結果に含まれない */
    @Query("""
            select l.post.id as postId, count(l) as count from PostLike l
            where l.post.id in :postIds
            group by l.post.id
            """)
    List<PostCount> countByPostIds(@Param("postIds") Collection<Long> postIds);

    /** postIds のうち、userId がいいね済みの投稿IDをまとめて取得する(設計書 3-2) */
    @Query("select l.post.id from PostLike l where l.user.id = :userId and l.post.id in :postIds")
    List<Long> findLikedPostIds(@Param("userId") Long userId, @Param("postIds") Collection<Long> postIds);
}
