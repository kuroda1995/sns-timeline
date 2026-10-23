package com.example.snstimeline.repository;

import com.example.snstimeline.entity.Comment;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Limit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface CommentRepository extends JpaRepository<Comment, Long> {

    /**
     * C-01 コメント一覧。cursor より新しいコメントを古い順に取得する(1ページ目は cursor に 0 を渡す)。
     * コメント者は join fetch で一緒に取得する(N+1問題の回避、設計書 3-4)。
     */
    @Query("""
            select c from Comment c join fetch c.user
            where c.post.id = :postId and c.deletedAt is null and c.id > :cursor
            order by c.id asc
            """)
    List<Comment> findPage(@Param("postId") Long postId, @Param("cursor") long cursor, Limit limit);

    /** 削除されていないコメントを取得する。投稿が削除済みの場合も、コメントは見えないので対象外にする */
    @Query("""
            select c from Comment c
            where c.id = :id and c.deletedAt is null and c.post.deletedAt is null
            """)
    Optional<Comment> findVisibleById(@Param("id") Long id);

    /** 投稿のコメント数(削除済みは数えない) */
    long countByPostIdAndDeletedAtIsNull(Long postId);

    /** 投稿IDごとのコメント数をまとめて数える(設計書 3-2)。コメントが0件の投稿は結果に含まれない */
    @Query("""
            select c.post.id as postId, count(c) as count from Comment c
            where c.post.id in :postIds and c.deletedAt is null
            group by c.post.id
            """)
    List<PostCount> countByPostIds(@Param("postIds") Collection<Long> postIds);
}
