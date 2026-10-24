package com.example.snstimeline.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.example.snstimeline.dto.FollowResponse;
import com.example.snstimeline.dto.PageResponse;
import com.example.snstimeline.dto.UserSummary;
import com.example.snstimeline.entity.Follow;
import com.example.snstimeline.entity.User;
import com.example.snstimeline.exception.ApiException;
import com.example.snstimeline.repository.FollowRepository;
import com.example.snstimeline.repository.UserRepository;
import java.util.List;
import java.util.Optional;
import java.util.stream.LongStream;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.Limit;
import org.springframework.http.HttpStatus;
import org.springframework.test.util.ReflectionTestUtils;

class FollowServiceTest {

    private static final long HANAKO_ID = 2L;
    private static final long TARO_ID = 3L;

    private FollowRepository followRepository;
    private UserRepository userRepository;
    private FollowService followService;
    private User hanako;
    private User taro;

    @BeforeEach
    void setUp() {
        followRepository = mock(FollowRepository.class);
        userRepository = mock(UserRepository.class);
        followService = new FollowService(followRepository, userRepository);
        hanako = user(HANAKO_ID, "hanako");
        taro = user(TARO_ID, "taro");
        when(userRepository.findByUsernameIgnoreCase("hanako")).thenReturn(Optional.of(hanako));
        when(userRepository.findByUsernameIgnoreCase("taro")).thenReturn(Optional.of(taro));
    }

    private static User user(long id, String username) {
        User user = new User(username, username + "@example.com", "hash", username);
        ReflectionTestUtils.setField(user, "id", id);
        return user;
    }

    private static Follow follow(long id, User follower, User followee) {
        Follow follow = new Follow(follower, followee);
        ReflectionTestUtils.setField(follow, "id", id);
        return follow;
    }

    private static void assertStatus(Runnable action, HttpStatus status) {
        assertThatThrownBy(action::run).isInstanceOfSatisfying(ApiException.class,
                e -> assertThat(e.getStatus()).isEqualTo(status));
    }

    @Test
    void follow_登録して相手の最新のフォロワー数を返す_フォロー済みでも成功() {
        when(followRepository.insertIfAbsent(HANAKO_ID, TARO_ID)).thenReturn(0);
        when(followRepository.countByFolloweeId(TARO_ID)).thenReturn(35L);

        FollowResponse response = followService.follow(HANAKO_ID, "taro");

        verify(followRepository).insertIfAbsent(HANAKO_ID, TARO_ID);
        assertThat(response.followedByMe()).isTrue();
        assertThat(response.followerCount()).isEqualTo(35L);
    }

    @Test
    void unfollow_削除して最新のフォロワー数を返す_フォローしていなくても成功() {
        when(followRepository.deleteByFollowerIdAndFolloweeId(HANAKO_ID, TARO_ID)).thenReturn(0);
        when(followRepository.countByFolloweeId(TARO_ID)).thenReturn(34L);

        FollowResponse response = followService.unfollow(HANAKO_ID, "taro");

        verify(followRepository).deleteByFollowerIdAndFolloweeId(HANAKO_ID, TARO_ID);
        assertThat(response.followedByMe()).isFalse();
        assertThat(response.followerCount()).isEqualTo(34L);
    }

    @Test
    void follow_unfollow_自分自身は400で登録も削除もしない() {
        assertThatThrownBy(() -> followService.follow(HANAKO_ID, "hanako"))
                .isInstanceOfSatisfying(ApiException.class, e -> {
                    assertThat(e.getStatus()).isEqualTo(HttpStatus.BAD_REQUEST);
                    assertThat(e.getMessage()).isEqualTo(FollowService.SELF_FOLLOW_MESSAGE);
                });
        assertStatus(() -> followService.unfollow(HANAKO_ID, "hanako"), HttpStatus.BAD_REQUEST);
        verify(followRepository, never()).insertIfAbsent(anyLong(), anyLong());
        verify(followRepository, never()).deleteByFollowerIdAndFolloweeId(anyLong(), anyLong());
    }

    @Test
    void follow_存在しないユーザーは404() {
        when(userRepository.findByUsernameIgnoreCase("nobody")).thenReturn(Optional.empty());

        assertStatus(() -> followService.follow(HANAKO_ID, "nobody"), HttpStatus.NOT_FOUND);
        assertStatus(() -> followService.following(HANAKO_ID, "nobody", null), HttpStatus.NOT_FOUND);
    }

    @Test
    void following_相手のユーザーを返しfollowedByMeとisMeはログイン中のユーザーから見た値() {
        User jiro = user(4L, "jiro");
        // 太郎がフォローしている人: 次郎(花子はフォローしていない)と花子自身
        when(followRepository.findFollowing(TARO_ID, Long.MAX_VALUE, Limit.of(21)))
                .thenReturn(List.of(follow(12, taro, jiro), follow(11, taro, hanako)));
        when(followRepository.findFollowedIds(HANAKO_ID, List.of(4L, HANAKO_ID))).thenReturn(List.of());

        PageResponse<UserSummary> page = followService.following(HANAKO_ID, "taro", null);

        assertThat(page.items()).extracting(UserSummary::username).containsExactly("jiro", "hanako");
        assertThat(page.items()).extracting(UserSummary::followedByMe).containsExactly(false, false);
        assertThat(page.items()).extracting(UserSummary::isMe).containsExactly(false, true);
        assertThat(page.hasNext()).isFalse();
        assertThat(page.nextCursor()).isNull();
    }

    @Test
    void followers_21件取れたら20件だけ返し最後のフォローIDを次のcursorにする_followedByMeは1回で判定() {
        List<Follow> follows = LongStream.rangeClosed(1, 21)
                .mapToObj(i -> follow(200 - i, user(100 + i, "user" + i), taro))
                .toList();
        when(followRepository.findFollowers(TARO_ID, 500L, Limit.of(21))).thenReturn(follows);
        when(followRepository.findFollowedIds(any(), any())).thenReturn(List.of(101L));

        PageResponse<UserSummary> page = followService.followers(HANAKO_ID, "taro", 500L);

        assertThat(page.items()).hasSize(20);
        assertThat(page.hasNext()).isTrue();
        assertThat(page.nextCursor()).isEqualTo(180L);
        assertThat(page.items().getFirst().followedByMe()).isTrue();
        assertThat(page.items().get(1).followedByMe()).isFalse();
        // N+1問題の回避: 20人分の followedByMe をまとめて1回で取得する
        verify(followRepository, times(1)).findFollowedIds(any(), any());
    }

    @Test
    void toSummaries_空なら判定のSQLを発行しない() {
        assertThat(followService.toSummaries(List.of(), HANAKO_ID)).isEmpty();
        verifyNoInteractions(followRepository);
    }
}
