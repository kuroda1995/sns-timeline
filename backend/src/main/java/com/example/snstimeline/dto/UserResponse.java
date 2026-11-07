package com.example.snstimeline.dto;

import com.example.snstimeline.entity.User;
import com.example.snstimeline.service.storage.ImageStorage;
import io.swagger.v3.oas.annotations.media.Schema;

/** ログイン中のユーザー情報(A-01〜A-03 のレスポンスの user) */
public record UserResponse(Long id, String username, String displayName,
        @Schema(types = {"string", "null"}, description = "アイコン画像のURL。未設定なら null") String avatarUrl,
        String bio) {

    /** avatarUrl は保存キー(avatar_key)から組み立てる。アイコン未設定なら null */
    public static UserResponse from(User user, ImageStorage imageStorage) {
        return new UserResponse(user.getId(), user.getUsername(), user.getDisplayName(),
                imageStorage.toUrl(user.getAvatarKey()), user.getBio());
    }
}
