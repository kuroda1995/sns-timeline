package com.example.snstimeline.dto;

import com.example.snstimeline.entity.User;

/** ログイン中のユーザー情報(A-01〜A-03 のレスポンスの user) */
public record UserResponse(Long id, String username, String displayName, String avatarUrl, String bio) {

    public static UserResponse from(User user) {
        // avatarUrl は画像保存(ImageStorage)の実装時に avatar_key から組み立てる
        return new UserResponse(user.getId(), user.getUsername(), user.getDisplayName(), null, user.getBio());
    }
}
