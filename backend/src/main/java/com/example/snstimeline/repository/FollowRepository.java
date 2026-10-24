package com.example.snstimeline.repository;

import com.example.snstimeline.entity.Follow;
import java.util.Collection;
import java.util.List;
import org.springframework.data.domain.Limit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface FollowRepository extends JpaRepository<Follow, Long> {

    /** userId がフォローしている人の数(フォロー数) */
    long countByFollowerId(Long userId);

    /** userId をフォローしている人の数(フォロワー数) */
    long countByFolloweeId(Long userId);

    boolean existsByFollowerIdAndFolloweeId(Long followerId, Long followeeId);

    /**
     * F-01 フォローする。既にフォロー済みなら何もしない(冪等、フォロー機能 処理のルール No.2・3)。
     * いいねと同じく、連打で同時に届いても一意制約違反にならないよう、重複の判定はDBに任せる。
     */
    @Modifying
    @Query(value = """
            insert into follows (follower_id, followee_id, created_at) values (:followerId, :followeeId, now())
            on conflict (follower_id, followee_id) do nothing
            """, nativeQuery = true)
    int insertIfAbsent(@Param("followerId") Long followerId, @Param("followeeId") Long followeeId);

    /** F-02 フォロー解除(物理削除)。フォローしていなければ何もしない(冪等) */
    @Modifying
    @Query("delete from Follow f where f.follower.id = :followerId and f.followee.id = :followeeId")
    int deleteByFollowerIdAndFolloweeId(@Param("followerId") Long followerId, @Param("followeeId") Long followeeId);

    /**
     * F-03 フォロー中の一覧。フォローした日時が新しい順(follows.id の降順)。1ページ目は cursor に Long.MAX_VALUE を渡す。
     * 相手のユーザーは join fetch で一緒に取得する(N+1問題の回避、設計書 3-4)。
     */
    @Query("""
            select f from Follow f join fetch f.followee
            where f.follower.id = :userId and f.id < :cursor
            order by f.id desc
            """)
    List<Follow> findFollowing(@Param("userId") Long userId, @Param("cursor") long cursor, Limit limit);

    /** F-04 フォロワーの一覧。並び順・ページングは F-03 と同じ */
    @Query("""
            select f from Follow f join fetch f.follower
            where f.followee.id = :userId and f.id < :cursor
            order by f.id desc
            """)
    List<Follow> findFollowers(@Param("userId") Long userId, @Param("cursor") long cursor, Limit limit);

    /** userIds のうち、followerId がフォローしている人のIDをまとめて取得する(設計書 3-4) */
    @Query("select f.followee.id from Follow f where f.follower.id = :followerId and f.followee.id in :userIds")
    List<Long> findFollowedIds(@Param("followerId") Long followerId, @Param("userIds") Collection<Long> userIds);
}
