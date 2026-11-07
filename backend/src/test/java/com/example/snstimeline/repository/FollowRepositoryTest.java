package com.example.snstimeline.repository;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.example.snstimeline.entity.Follow;
import com.example.snstimeline.entity.User;
import com.example.snstimeline.support.RepositoryTest;
import com.example.snstimeline.support.TestData;
import java.util.List;
import org.hibernate.Hibernate;
import org.hibernate.exception.ConstraintViolationException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.jpa.test.autoconfigure.TestEntityManager;
import org.springframework.data.domain.Limit;

@RepositoryTest
class FollowRepositoryTest {

    @Autowired
    private FollowRepository followRepository;

    @Autowired
    private TestEntityManager em;

    private TestData data;
    private User me;
    private User taro;
    private User jiro;

    @BeforeEach
    void setUp() {
        data = new TestData(em);
        me = data.user("me");
        taro = data.user("taro");
        jiro = data.user("jiro");
    }

    private static List<Long> ids(List<Follow> follows) {
        return follows.stream().map(Follow::getId).toList();
    }

    @Test
    void insertIfAbsent_1回目は登録し_2回目は一意制約違反にせず何もしない() {
        assertThat(followRepository.insertIfAbsent(me.getId(), taro.getId())).isEqualTo(1);
        assertThat(followRepository.insertIfAbsent(me.getId(), taro.getId())).isZero();

        assertThat(followRepository.existsByFollowerIdAndFolloweeId(me.getId(), taro.getId())).isTrue();
        // 向きがあるので、逆向きはフォローしていない
        assertThat(followRepository.existsByFollowerIdAndFolloweeId(taro.getId(), me.getId())).isFalse();
    }

    @Test
    void 自分自身はDBの制約でフォローできない() {
        // ck_follows_not_self(設計書 2-6)
        assertThatThrownBy(() -> followRepository.insertIfAbsent(me.getId(), me.getId()))
                .rootCause()
                .hasMessageContaining("ck_follows_not_self");
    }

    @Test
    void deleteByFollowerIdAndFolloweeId_フォロー解除し_フォローしていなければ0件() {
        data.follow(me, taro);
        data.follow(jiro, taro);

        assertThat(followRepository.deleteByFollowerIdAndFolloweeId(me.getId(), taro.getId())).isEqualTo(1);
        assertThat(followRepository.deleteByFollowerIdAndFolloweeId(me.getId(), taro.getId())).isZero();
        assertThat(followRepository.countByFolloweeId(taro.getId())).isEqualTo(1);
    }

    @Test
    void countByFollowerId_countByFolloweeId_フォロー数とフォロワー数を数える() {
        data.follow(me, taro);
        data.follow(me, jiro);
        data.follow(taro, me);

        assertThat(followRepository.countByFollowerId(me.getId())).isEqualTo(2);
        assertThat(followRepository.countByFolloweeId(me.getId())).isEqualTo(1);
        assertThat(followRepository.countByFolloweeId(jiro.getId())).isEqualTo(1);
        assertThat(followRepository.countByFollowerId(jiro.getId())).isZero();
    }

    @Test
    void findFollowing_フォローした日時が新しい順に相手と一緒に取得し_cursorでページングする() {
        User saburo = data.user("saburo");
        Follow f1 = data.follow(me, taro);
        data.follow(taro, jiro);
        Follow f2 = data.follow(me, jiro);
        Follow f3 = data.follow(me, saburo);
        data.clear();

        List<Follow> page1 = followRepository.findFollowing(me.getId(), Long.MAX_VALUE, Limit.of(2));

        assertThat(ids(page1)).containsExactly(f3.getId(), f2.getId());
        assertThat(page1).allMatch(f -> Hibernate.isInitialized(f.getFollowee()));
        assertThat(page1.get(0).getFollowee().getUsername()).isEqualTo("saburo");
        assertThat(ids(followRepository.findFollowing(me.getId(), f2.getId(), Limit.of(2))))
                .containsExactly(f1.getId());
    }

    @Test
    void findFollowers_フォローされた日時が新しい順にフォローした人と一緒に取得する() {
        Follow f1 = data.follow(taro, me);
        data.follow(me, jiro);
        Follow f2 = data.follow(jiro, me);
        data.clear();

        List<Follow> followers = followRepository.findFollowers(me.getId(), Long.MAX_VALUE, Limit.of(10));

        assertThat(ids(followers)).containsExactly(f2.getId(), f1.getId());
        assertThat(followers).allMatch(f -> Hibernate.isInitialized(f.getFollower()));
        assertThat(followers).extracting(f -> f.getFollower().getUsername()).containsExactly("jiro", "taro");
    }

    @Test
    void findFollowedIds_渡したユーザーのうちフォロー中の人のIDだけを返す() {
        User saburo = data.user("saburo");
        data.follow(me, taro);
        data.follow(me, saburo);
        data.follow(jiro, me);

        assertThat(followRepository.findFollowedIds(me.getId(), List.of(taro.getId(), jiro.getId())))
                .containsExactly(taro.getId());
    }

    @Test
    void 同じ組み合わせのフォローは一意制約で2件登録できない() {
        data.follow(me, taro);

        assertThatThrownBy(() -> data.follow(me, taro)).isInstanceOf(ConstraintViolationException.class);
    }
}
