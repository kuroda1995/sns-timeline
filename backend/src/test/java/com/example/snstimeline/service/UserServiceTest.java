package com.example.snstimeline.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.example.snstimeline.dto.PageResponse;
import com.example.snstimeline.dto.ProfileResponse;
import com.example.snstimeline.dto.UpdateProfileRequest;
import com.example.snstimeline.entity.User;
import com.example.snstimeline.exception.ApiException;
import com.example.snstimeline.repository.FollowRepository;
import com.example.snstimeline.repository.UserRepository;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.test.util.ReflectionTestUtils;

class UserServiceTest {

    private static final long HANAKO_ID = 2L;
    private static final long TARO_ID = 3L;

    private UserRepository userRepository;
    private FollowRepository followRepository;
    private PostQueryService postQueryService;
    private UserService userService;
    private User hanako;
    private User taro;

    @BeforeEach
    void setUp() {
        userRepository = mock(UserRepository.class);
        followRepository = mock(FollowRepository.class);
        postQueryService = mock(PostQueryService.class);
        userService = new UserService(userRepository, followRepository, postQueryService);
        hanako = user(HANAKO_ID, "hanako", "花子");
        taro = user(TARO_ID, "taro", "太郎");
        when(userRepository.findById(HANAKO_ID)).thenReturn(Optional.of(hanako));
        when(userRepository.findByUsernameIgnoreCase("hanako")).thenReturn(Optional.of(hanako));
        when(userRepository.findByUsernameIgnoreCase("taro")).thenReturn(Optional.of(taro));
    }

    private static User user(long id, String username, String displayName) {
        User user = new User(username, username + "@example.com", "hash", displayName);
        ReflectionTestUtils.setField(user, "id", id);
        return user;
    }

    private static void assertBadField(Runnable action, String field, String message) {
        assertThatThrownBy(action::run).isInstanceOfSatisfying(ApiException.class, e -> {
            assertThat(e.getStatus()).isEqualTo(HttpStatus.BAD_REQUEST);
            assertThat(e.getField()).isEqualTo(field);
            assertThat(e.getMessage()).isEqualTo(message);
        });
    }

    @Test
    void profile_他人のプロフィールはフォロー数_フォロワー数_自分がフォロー済みかを返す() {
        when(followRepository.countByFollowerId(TARO_ID)).thenReturn(12L);
        when(followRepository.countByFolloweeId(TARO_ID)).thenReturn(34L);
        when(followRepository.existsByFollowerIdAndFolloweeId(HANAKO_ID, TARO_ID)).thenReturn(true);

        ProfileResponse profile = userService.profile(HANAKO_ID, "taro");

        assertThat(profile.username()).isEqualTo("taro");
        assertThat(profile.displayName()).isEqualTo("太郎");
        assertThat(profile.followingCount()).isEqualTo(12L);
        assertThat(profile.followerCount()).isEqualTo(34L);
        assertThat(profile.followedByMe()).isTrue();
        assertThat(profile.isMe()).isFalse();
    }

    @Test
    void profile_自分のプロフィールはisMeがtrueでfollowedByMeは確認しない() {
        ProfileResponse profile = userService.profile(HANAKO_ID, "hanako");

        assertThat(profile.isMe()).isTrue();
        assertThat(profile.followedByMe()).isFalse();
        verify(followRepository, never()).existsByFollowerIdAndFolloweeId(anyLong(), anyLong());
    }

    @Test
    void profile_存在しないユーザーは404() {
        when(userRepository.findByUsernameIgnoreCase("nobody")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> userService.profile(HANAKO_ID, "nobody"))
                .isInstanceOfSatisfying(ApiException.class, e -> {
                    assertThat(e.getStatus()).isEqualTo(HttpStatus.NOT_FOUND);
                    assertThat(e.getMessage()).isEqualTo(UserService.NOT_FOUND_MESSAGE);
                });
    }

    @Test
    void posts_ユーザーIDを渡してタイムラインと同じ組み立て処理を使う() {
        PageResponse<com.example.snstimeline.dto.PostResponse> page = new PageResponse<>(List.of(), null, false);
        when(postQueryService.userPosts(HANAKO_ID, TARO_ID, 101L)).thenReturn(page);

        assertThat(userService.posts(HANAKO_ID, "taro", 101L)).isSameAs(page);
    }

    @Test
    void posts_存在しないユーザーは404() {
        when(userRepository.findByUsernameIgnoreCase("nobody")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> userService.posts(HANAKO_ID, "nobody", null))
                .isInstanceOfSatisfying(ApiException.class,
                        e -> assertThat(e.getStatus()).isEqualTo(HttpStatus.NOT_FOUND));
    }

    @Test
    void updateMe_前後の空白を取り除き自己紹介の改行はLFにそろえて保存する() {
        ProfileResponse profile = userService.updateMe(HANAKO_ID,
                new UpdateProfileRequest("  はなこ ", "\r\n Javaを勉強中です。\r\nよろしく \n"));

        assertThat(hanako.getDisplayName()).isEqualTo("はなこ");
        assertThat(hanako.getBio()).isEqualTo("Javaを勉強中です。\nよろしく");
        assertThat(profile.displayName()).isEqualTo("はなこ");
        assertThat(profile.isMe()).isTrue();
    }

    @Test
    void updateMe_自己紹介は空でもよい() {
        userService.updateMe(HANAKO_ID, new UpdateProfileRequest("花子", null));

        assertThat(hanako.getBio()).isEmpty();
    }

    @Test
    void updateMe_表示名は1から50文字で絵文字も1文字と数える() {
        userService.updateMe(HANAKO_ID, new UpdateProfileRequest("😀".repeat(50), ""));

        assertBadField(() -> userService.updateMe(HANAKO_ID, new UpdateProfileRequest("😀".repeat(51), "")),
                "displayName", "50文字以内で入力してください");
        assertBadField(() -> userService.updateMe(HANAKO_ID, new UpdateProfileRequest(" 　", "")),
                "displayName", "表示名を入力してください");
        assertBadField(() -> userService.updateMe(HANAKO_ID, new UpdateProfileRequest(null, "")),
                "displayName", "表示名を入力してください");
    }

    @Test
    void updateMe_自己紹介は160文字まで_161文字は400で更新しない() {
        userService.updateMe(HANAKO_ID, new UpdateProfileRequest("花子", "あ".repeat(160)));

        assertBadField(() -> userService.updateMe(HANAKO_ID, new UpdateProfileRequest("別の名前", "あ".repeat(161))),
                "bio", "160文字以内で入力してください");
        assertThat(hanako.getDisplayName()).isEqualTo("花子");
    }
}
