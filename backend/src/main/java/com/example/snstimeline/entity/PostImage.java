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
 * post_images テーブル(設計書 2-3)。画像そのものはDBに入れず、保存キー(ImageStorage の保存先のパス)だけを記録する。
 */
@Entity
@Table(name = "post_images",
        uniqueConstraints = @UniqueConstraint(name = "uq_post_images_order", columnNames = {"post_id", "sort_order"}),
        check = @CheckConstraint(name = "ck_post_images_order", constraint = "sort_order between 1 and 4"))
public class PostImage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "post_id", nullable = false)
    private Post post;

    /** 保存キー(例: posts/2026/10/550e8400-....jpg)。URLは保存しない */
    @Column(name = "image_key", nullable = false, length = 255)
    private String imageKey;

    /** 表示順(1〜4)。アップロード時に選んだ順 */
    @Column(name = "sort_order", nullable = false)
    private short sortOrder;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    protected PostImage() {
    }

    public PostImage(Post post, String imageKey, int sortOrder) {
        this.post = post;
        this.imageKey = imageKey;
        this.sortOrder = (short) sortOrder;
    }

    public Long getId() {
        return id;
    }

    public Post getPost() {
        return post;
    }

    public String getImageKey() {
        return imageKey;
    }

    public int getSortOrder() {
        return sortOrder;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
