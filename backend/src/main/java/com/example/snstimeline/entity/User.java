package com.example.snstimeline.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

/**
 * users テーブル(設計書 2-1)。
 * username・email の「大文字小文字を区別しない一意制約」は schema.sql で作成する。
 */
@Entity
@Table(name = "users")
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 15)
    private String username;

    /** 前後の空白を除き、小文字に変換した値を保存する */
    @Column(nullable = false, length = 255)
    private String email;

    @Column(name = "password_hash", nullable = false, length = 255)
    private String passwordHash;

    @Column(name = "display_name", nullable = false, length = 50)
    private String displayName;

    @Column(nullable = false, length = 160)
    private String bio = "";

    @Column(name = "avatar_key", length = 255)
    private String avatarKey;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected User() {
    }

    public User(String username, String email, String passwordHash, String displayName) {
        this.username = username;
        this.email = email;
        this.passwordHash = passwordHash;
        this.displayName = displayName;
    }

    /**
     * U-06 アイコン画像の変更。新しい保存キーに差し替え、元の保存キー(未設定なら null)を返す。
     * 古い画像ファイルの削除は UserService で行う
     */
    public String changeAvatar(String avatarKey) {
        String previous = this.avatarKey;
        this.avatarKey = avatarKey;
        return previous;
    }

    /** U-05 プロフィール更新。入力チェックは UserService で行う */
    public void updateProfile(String displayName, String bio) {
        this.displayName = displayName;
        this.bio = bio;
    }

    public Long getId() {
        return id;
    }

    public String getUsername() {
        return username;
    }

    public String getEmail() {
        return email;
    }

    public String getPasswordHash() {
        return passwordHash;
    }

    public String getDisplayName() {
        return displayName;
    }

    public String getBio() {
        return bio;
    }

    public String getAvatarKey() {
        return avatarKey;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}
