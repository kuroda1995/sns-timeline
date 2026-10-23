package com.example.snstimeline.entity;

import jakarta.persistence.CheckConstraint;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.time.Instant;
import org.hibernate.annotations.CreationTimestamp;

/**
 * follows テーブル(設計書 2-6)。
 * タイムライン(フォロー中＋自分の投稿)の取得に使うため、テーブルだけ先に用意する。
 * フォローする・解除するAPIはフォロー機能で実装する。
 */
@Entity
@Table(name = "follows",
        uniqueConstraints = @UniqueConstraint(name = "uq_follows_pair", columnNames = {"follower_id", "followee_id"}),
        check = @CheckConstraint(name = "ck_follows_not_self", constraint = "follower_id <> followee_id"))
public class Follow {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** フォローする側 */
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "follower_id", nullable = false)
    private User follower;

    /** フォローされる側 */
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "followee_id", nullable = false)
    private User followee;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    protected Follow() {
    }

    public Follow(User follower, User followee) {
        this.follower = follower;
        this.followee = followee;
    }

    public Long getId() {
        return id;
    }

    public User getFollower() {
        return follower;
    }

    public User getFollowee() {
        return followee;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
