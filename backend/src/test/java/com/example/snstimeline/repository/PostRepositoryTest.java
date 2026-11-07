package com.example.snstimeline.repository;

import static org.assertj.core.api.Assertions.assertThat;

import com.example.snstimeline.entity.Post;
import com.example.snstimeline.entity.User;
import com.example.snstimeline.support.RepositoryTest;
import com.example.snstimeline.support.TestData;
import java.util.List;
import org.hibernate.Hibernate;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.jpa.test.autoconfigure.TestEntityManager;
import org.springframework.data.domain.Limit;

@RepositoryTest
class PostRepositoryTest {

    @Autowired
    private PostRepository postRepository;

    @Autowired
    private TestEntityManager em;

    private TestData data;
    private User me;
    private User followee;
    private User stranger;

    @BeforeEach
    void setUp() {
        data = new TestData(em);
        me = data.user("me");
        followee = data.user("followee");
        stranger = data.user("stranger");
        data.follow(me, followee);
    }

    private static List<Long> ids(List<Post> posts) {
        return posts.stream().map(Post::getId).toList();
    }

    @Test
    void findVisibleById_削除されていない投稿を投稿者と一緒に取得する() {
        Post post = data.post(followee, "こんにちは");
        data.clear();

        Post found = postRepository.findVisibleById(post.getId()).orElseThrow();

        assertThat(found.getContent()).isEqualTo("こんにちは");
        // join fetch で投稿者も読み込み済み(N+1問題の回避、設計書 3-4)
        assertThat(Hibernate.isInitialized(found.getUser())).isTrue();
        assertThat(found.getUser().getUsername()).isEqualTo("followee");
    }

    @Test
    void findVisibleById_削除済みの投稿は取得しない() {
        Post deleted = data.deletedPost(me, "消した投稿");

        assertThat(postRepository.findVisibleById(deleted.getId())).isEmpty();
    }

    @Test
    void existsByIdAndDeletedAtIsNull_削除済みや存在しない投稿はfalse() {
        Post post = data.post(me, "a");
        Post deleted = data.deletedPost(me, "b");

        assertThat(postRepository.existsByIdAndDeletedAtIsNull(post.getId())).isTrue();
        assertThat(postRepository.existsByIdAndDeletedAtIsNull(deleted.getId())).isFalse();
        assertThat(postRepository.existsByIdAndDeletedAtIsNull(Long.MAX_VALUE)).isFalse();
    }

    @Test
    void findTimeline_自分とフォロー中のユーザーの投稿だけを新しい順に返す() {
        Post mine = data.post(me, "自分");
        Post followees = data.post(followee, "フォロー中");
        data.post(stranger, "フォローしていない人");
        data.deletedPost(followee, "削除済み");
        Post newest = data.post(me, "自分の新しい投稿");
        data.clear();

        List<Post> timeline = postRepository.findTimeline(me.getId(), Long.MAX_VALUE, Limit.of(10));

        assertThat(ids(timeline)).containsExactly(newest.getId(), followees.getId(), mine.getId());
        assertThat(timeline).allMatch(p -> Hibernate.isInitialized(p.getUser()));
    }

    @Test
    void findTimeline_cursorより古い投稿をlimit件だけ返す() {
        Post p1 = data.post(me, "1");
        Post p2 = data.post(followee, "2");
        Post p3 = data.post(me, "3");
        Post p4 = data.post(followee, "4");

        // 1ページ目
        assertThat(ids(postRepository.findTimeline(me.getId(), Long.MAX_VALUE, Limit.of(2))))
                .containsExactly(p4.getId(), p3.getId());
        // 2ページ目は、1ページ目の最後の投稿IDを cursor にする
        assertThat(ids(postRepository.findTimeline(me.getId(), p3.getId(), Limit.of(2))))
                .containsExactly(p2.getId(), p1.getId());
        assertThat(postRepository.findTimeline(me.getId(), p1.getId(), Limit.of(2))).isEmpty();
    }

    @Test
    void findTimeline_誰もフォローしていなくても自分の投稿は表示される() {
        Post own = data.post(stranger, "フォロー0人");
        data.post(me, "他人の投稿");

        assertThat(ids(postRepository.findTimeline(stranger.getId(), Long.MAX_VALUE, Limit.of(10))))
                .containsExactly(own.getId());
    }

    @Test
    void findByAuthor_そのユーザーの削除されていない投稿だけを新しい順に返す() {
        Post old = data.post(followee, "古い");
        data.post(me, "別の人");
        data.deletedPost(followee, "削除済み");
        Post recent = data.post(followee, "新しい");

        assertThat(ids(postRepository.findByAuthor(followee.getId(), Long.MAX_VALUE, Limit.of(10))))
                .containsExactly(recent.getId(), old.getId());
        assertThat(ids(postRepository.findByAuthor(followee.getId(), recent.getId(), Limit.of(10))))
                .containsExactly(old.getId());
    }

    @Test
    void findTimelineSince_sinceより新しい投稿だけを新しい順に返す() {
        Post seen = data.post(me, "表示済み");
        Post new1 = data.post(followee, "新着1");
        data.post(stranger, "フォローしていない人の新着");
        data.deletedPost(followee, "削除済みの新着");
        Post new2 = data.post(me, "新着2");

        assertThat(ids(postRepository.findTimelineSince(me.getId(), seen.getId(), Limit.of(10))))
                .containsExactly(new2.getId(), new1.getId());
        assertThat(postRepository.findTimelineSince(me.getId(), new2.getId(), Limit.of(10))).isEmpty();
    }
}
