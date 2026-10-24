package com.example.snstimeline.service;

import com.example.snstimeline.dto.FollowResponse;
import com.example.snstimeline.dto.PageResponse;
import com.example.snstimeline.dto.UserSummary;
import com.example.snstimeline.entity.Follow;
import com.example.snstimeline.entity.User;
import com.example.snstimeline.exception.ApiException;
import com.example.snstimeline.repository.FollowRepository;
import com.example.snstimeline.repository.UserRepository;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.function.Function;
import org.springframework.data.domain.Limit;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** フォロー・解除と、フォロー中／フォロワーの一覧(フォロー機能 FLW-01〜04) */
@Service
public class FollowService {

    static final int PAGE_SIZE = 20;
    static final String SELF_FOLLOW_MESSAGE = "自分自身はフォローできません";

    private final FollowRepository followRepository;
    private final UserRepository userRepository;

    public FollowService(FollowRepository followRepository, UserRepository userRepository) {
        this.followRepository = followRepository;
        this.userRepository = userRepository;
    }

    /** F-01 フォローする。既にフォロー済みでも成功として扱う */
    @Transactional
    public FollowResponse follow(Long me, String username) {
        User target = findOtherUser(me, username);
        followRepository.insertIfAbsent(me, target.getId());
        return new FollowResponse(true, followRepository.countByFolloweeId(target.getId()));
    }

    /** F-02 フォロー解除。フォローしていなくても成功として扱う */
    @Transactional
    public FollowResponse unfollow(Long me, String username) {
        User target = findOtherUser(me, username);
        followRepository.deleteByFollowerIdAndFolloweeId(me, target.getId());
        return new FollowResponse(false, followRepository.countByFolloweeId(target.getId()));
    }

    /** F-03 username がフォローしている人の一覧 */
    @Transactional(readOnly = true)
    public PageResponse<UserSummary> following(Long me, String username, Long cursor) {
        User user = findUser(username);
        List<Follow> follows = followRepository.findFollowing(user.getId(), before(cursor), Limit.of(PAGE_SIZE + 1));
        return toPage(follows, Follow::getFollowee, me);
    }

    /** F-04 username をフォローしている人の一覧 */
    @Transactional(readOnly = true)
    public PageResponse<UserSummary> followers(Long me, String username, Long cursor) {
        User user = findUser(username);
        List<Follow> follows = followRepository.findFollowers(user.getId(), before(cursor), Limit.of(PAGE_SIZE + 1));
        return toPage(follows, Follow::getFollower, me);
    }

    /**
     * ユーザーの一覧を画面に返す形にする。followedByMe は一覧のユーザーIDをまとめて渡して1回で判定する
     * (N+1問題の回避、設計書 3-4)。ユーザー検索でも使う。
     */
    public List<UserSummary> toSummaries(List<User> users, Long me) {
        if (users.isEmpty()) {
            return List.of();
        }
        List<Long> userIds = users.stream().map(User::getId).toList();
        Set<Long> followedIds = new HashSet<>(followRepository.findFollowedIds(me, userIds));
        return users.stream()
                .map(u -> new UserSummary(
                        u.getId(),
                        u.getUsername(),
                        u.getDisplayName(),
                        // avatarUrl は画像保存(ImageStorage)の実装時に avatar_key から組み立てる
                        null,
                        u.getBio(),
                        followedIds.contains(u.getId()),
                        u.getId().equals(me)))
                .toList();
    }

    /** PAGE_SIZE + 1 件取得した結果から、20件と次のページがあるかを組み立てる。nextCursor は follows.id */
    private PageResponse<UserSummary> toPage(List<Follow> follows, Function<Follow, User> toUser, Long me) {
        boolean hasNext = follows.size() > PAGE_SIZE;
        List<Follow> page = hasNext ? follows.subList(0, PAGE_SIZE) : follows;
        Long nextCursor = hasNext ? page.getLast().getId() : null;
        return new PageResponse<>(toSummaries(page.stream().map(toUser).toList(), me), nextCursor, hasNext);
    }

    private static long before(Long cursor) {
        return cursor == null ? Long.MAX_VALUE : cursor;
    }

    private User findUser(String username) {
        return userRepository.findByUsernameIgnoreCase(username)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, UserService.NOT_FOUND_MESSAGE));
    }

    /** 自分自身はフォロー・解除できない(処理のルール No.1)。DBの CHECK 制約より先に、分かりやすいエラーにする */
    private User findOtherUser(Long me, String username) {
        User user = findUser(username);
        if (user.getId().equals(me)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, SELF_FOLLOW_MESSAGE);
        }
        return user;
    }
}
