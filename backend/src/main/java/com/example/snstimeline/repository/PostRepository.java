package com.example.snstimeline.repository;

import com.example.snstimeline.entity.Post;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Limit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PostRepository extends JpaRepository<Post, Long> {

    /** 削除されていない投稿を、投稿者と一緒に取得する */
    @Query("select p from Post p join fetch p.user where p.id = :id and p.deletedAt is null")
    Optional<Post> findVisibleById(@Param("id") Long id);

    /**
     * T-01 タイムライン(設計書 3-1)。フォロー中のユーザー＋自分の投稿を、cursor より古いものから新しい順に取得する。
     * 1ページ目は cursor に Long.MAX_VALUE を渡す。
     */
    @Query("""
            select p from Post p join fetch p.user
            where p.deletedAt is null
              and (p.user.id = :me
                   or p.user.id in (select f.followee.id from Follow f where f.follower.id = :me))
              and p.id < :cursor
            order by p.id desc
            """)
    List<Post> findTimeline(@Param("me") Long me, @Param("cursor") long cursor, Limit limit);

    /** T-02 新着投稿(TL-05)。since より新しい投稿を、新しい順に取得する */
    @Query("""
            select p from Post p join fetch p.user
            where p.deletedAt is null
              and (p.user.id = :me
                   or p.user.id in (select f.followee.id from Follow f where f.follower.id = :me))
              and p.id > :since
            order by p.id desc
            """)
    List<Post> findTimelineSince(@Param("me") Long me, @Param("since") long since, Limit limit);
}
