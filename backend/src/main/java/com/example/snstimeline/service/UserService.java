package com.example.snstimeline.service;

import com.example.snstimeline.dto.AvatarResponse;
import com.example.snstimeline.dto.PageResponse;
import com.example.snstimeline.dto.PostResponse;
import com.example.snstimeline.dto.ProfileResponse;
import com.example.snstimeline.dto.UpdateProfileRequest;
import com.example.snstimeline.entity.User;
import com.example.snstimeline.exception.ApiException;
import com.example.snstimeline.repository.FollowRepository;
import com.example.snstimeline.repository.UserRepository;
import com.example.snstimeline.service.storage.ImageStorage;
import com.example.snstimeline.service.storage.ImageValidator;
import com.example.snstimeline.service.storage.ImageValidator.ValidatedImage;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.multipart.MultipartFile;

/** プロフィールの表示・更新(プロフィール機能 USER-01・02) */
@Service
public class UserService {

    static final int MAX_DISPLAY_NAME_LENGTH = 50;
    static final int MAX_BIO_LENGTH = 160;
    static final String NOT_FOUND_MESSAGE = "このアカウントは存在しません";

    private final UserRepository userRepository;
    private final FollowRepository followRepository;
    private final PostQueryService postQueryService;
    private final ImageValidator imageValidator;
    private final ImageStorage imageStorage;

    public UserService(UserRepository userRepository, FollowRepository followRepository,
            PostQueryService postQueryService, ImageValidator imageValidator, ImageStorage imageStorage) {
        this.userRepository = userRepository;
        this.followRepository = followRepository;
        this.postQueryService = postQueryService;
        this.imageValidator = imageValidator;
        this.imageStorage = imageStorage;
    }

    /** U-03 プロフィール */
    @Transactional(readOnly = true)
    public ProfileResponse profile(Long me, String username) {
        return toProfile(findByUsername(username), me);
    }

    /** U-04 ユーザーの投稿一覧(タイムラインと同じ形) */
    @Transactional(readOnly = true)
    public PageResponse<PostResponse> posts(Long me, String username, Long cursor) {
        return postQueryService.userPosts(me, findByUsername(username).getId(), cursor);
    }

    /**
     * U-05 プロフィール更新。更新できるのはログイン中のユーザー自身だけ
     * (他人のIDを指定して更新するAPIそのものを作らない、処理のルール No.1)。
     */
    @Transactional
    public ProfileResponse updateMe(Long me, UpdateProfileRequest request) {
        String displayName = normalizeDisplayName(request.displayName());
        String bio = normalizeBio(request.bio());
        User user = userRepository.findById(me)
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "ログインしてください"));
        user.updateProfile(displayName, bio);
        userRepository.flush();
        return toProfile(user, me);
    }

    /**
     * U-06 アイコン画像の変更(ログイン中のユーザー自身のみ)。形式・サイズのチェックは投稿画像と同じ。
     * 新しい画像を保存してからDBの保存キーを差し替え、DBへの保存が終わってから古い画像ファイルを削除する
     * (処理のルール No.3)。DBへの保存に失敗したら、新しく保存した画像を削除する。
     */
    @Transactional
    public AvatarResponse changeAvatar(Long me, MultipartFile avatar) {
        if (avatar == null || avatar.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "画像を選んでください", "avatar");
        }
        ValidatedImage image = imageValidator.validate(avatar, "avatar");
        User user = userRepository.findById(me)
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "ログインしてください"));
        String newKey = imageStorage.save(image.content(), "avatars", image.type().extension());
        String oldKey;
        try {
            oldKey = user.changeAvatar(newKey);
            userRepository.flush();
        } catch (RuntimeException e) {
            imageStorage.delete(newKey);
            throw e;
        }
        if (oldKey != null) {
            afterCommit(() -> imageStorage.delete(oldKey));
        }
        return new AvatarResponse(imageStorage.toUrl(newKey));
    }

    /** トランザクションが確定してから実行する(途中で取り消されたら、古い画像はまだ使われているので消さない) */
    private static void afterCommit(Runnable action) {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    action.run();
                }
            });
        } else {
            action.run();
        }
    }

    private User findByUsername(String username) {
        return userRepository.findByUsernameIgnoreCase(username)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, NOT_FOUND_MESSAGE));
    }

    private ProfileResponse toProfile(User user, Long me) {
        boolean isMe = user.getId().equals(me);
        return new ProfileResponse(
                user.getId(),
                user.getUsername(),
                user.getDisplayName(),
                imageStorage.toUrl(user.getAvatarKey()),
                user.getBio(),
                followRepository.countByFollowerId(user.getId()),
                followRepository.countByFolloweeId(user.getId()),
                !isMe && followRepository.existsByFollowerIdAndFolloweeId(me, user.getId()),
                isMe,
                user.getCreatedAt());
    }

    /** 表示名: 前後の空白を取り除いて1〜50文字(新規登録と同じルール)。絵文字も1文字と数える */
    static String normalizeDisplayName(String displayName) {
        String normalized = displayName == null ? "" : displayName.strip();
        if (normalized.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "表示名を入力してください", "displayName");
        }
        if (codePoints(normalized) > MAX_DISPLAY_NAME_LENGTH) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "50文字以内で入力してください", "displayName");
        }
        return normalized;
    }

    /** 自己紹介: 任意。改行は \n にそろえ、前後の空白・改行を取り除いて0〜160文字 */
    static String normalizeBio(String bio) {
        String normalized = bio == null ? "" : bio.replace("\r\n", "\n").replace('\r', '\n').strip();
        if (codePoints(normalized) > MAX_BIO_LENGTH) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "160文字以内で入力してください", "bio");
        }
        return normalized;
    }

    private static int codePoints(String s) {
        return s.codePointCount(0, s.length());
    }
}
