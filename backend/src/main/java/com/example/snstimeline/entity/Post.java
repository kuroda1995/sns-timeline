package com.example.snstimeline.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

/**
 * posts テーブル(設計書 2-2)。
 * 削除は論理削除(deleted_at に日時を入れる)。一覧用のインデックスは schema.sql で作成する。
 */
@Entity
@Table(name = "posts")
public class Post {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    /** 前後の空白・改行を取り除いた本文。画像だけの投稿の場合は空文字 */
    @Column(nullable = false, length = 140)
    private String content = "";

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    /** 本文を最後に編集した日時。NULL＝一度も編集していない(PST-04) */
    @Column(name = "edited_at")
    private Instant editedAt;

    /** 論理削除日時。NULL＝表示中 */
    @Column(name = "deleted_at")
    private Instant deletedAt;

    protected Post() {
    }

    public Post(User user, String content) {
        this.user = user;
        this.content = content;
    }

    public void edit(String content) {
        this.content = content;
        this.editedAt = Instant.now();
    }

    public void delete() {
        this.deletedAt = Instant.now();
    }

    public boolean isWrittenBy(Long userId) {
        return user.getId().equals(userId);
    }

    public Long getId() {
        return id;
    }

    public User getUser() {
        return user;
    }

    public String getContent() {
        return content;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public Instant getEditedAt() {
        return editedAt;
    }

    public Instant getDeletedAt() {
        return deletedAt;
    }
}
