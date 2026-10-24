package com.example.snstimeline.repository;

import com.example.snstimeline.entity.Follow;
import org.springframework.data.jpa.repository.JpaRepository;

public interface FollowRepository extends JpaRepository<Follow, Long> {

    /** userId がフォローしている人の数(フォロー数) */
    long countByFollowerId(Long userId);

    /** userId をフォローしている人の数(フォロワー数) */
    long countByFolloweeId(Long userId);

    boolean existsByFollowerIdAndFolloweeId(Long followerId, Long followeeId);
}
