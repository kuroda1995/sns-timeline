package com.example.snstimeline.repository;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;

import com.example.snstimeline.entity.Post;
import com.example.snstimeline.entity.User;
import com.example.snstimeline.support.RepositoryTest;
import com.example.snstimeline.support.TestData;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.jpa.test.autoconfigure.TestEntityManager;

@RepositoryTest
class LikeRepositoryTest {

    @Autowired
    private LikeRepository likeRepository;

    @Autowired
    private TestEntityManager em;

    private TestData data;
    private User hanako;
    private User taro;
    private Post post;

    @BeforeEach
    void setUp() {
        data = new TestData(em);
        hanako = data.user("hanako");
        taro = data.user("taro");
        post = data.post(taro, "いいねされる投稿");
    }

    @Test
    void insertIfAbsent_1回目は登録し_2回目は一意制約違反にせず何もしない() {
        // ON CONFLICT DO NOTHING(いいね機能 処理のルール No.1・2)
        assertThat(likeRepository.insertIfAbsent(hanako.getId(), post.getId())).isEqualTo(1);
        assertThat(likeRepository.insertIfAbsent(hanako.getId(), post.getId())).isZero();

        assertThat(likeRepository.countByPostId(post.getId())).isEqualTo(1);
    }

    @Test
    void insertIfAbsent_別の人のいいねは別々に数える() {
        likeRepository.insertIfAbsent(hanako.getId(), post.getId());
        likeRepository.insertIfAbsent(taro.getId(), post.getId());

        assertThat(likeRepository.countByPostId(post.getId())).isEqualTo(2);
    }

    @Test
    void deleteByUserIdAndPostId_自分のいいねだけを削除し_いいねしていなければ0件() {
        data.like(hanako, post);
        data.like(taro, post);

        assertThat(likeRepository.deleteByUserIdAndPostId(hanako.getId(), post.getId())).isEqualTo(1);
        assertThat(likeRepository.deleteByUserIdAndPostId(hanako.getId(), post.getId())).isZero();
        assertThat(likeRepository.countByPostId(post.getId())).isEqualTo(1);
    }

    @Test
    void countByPostIds_投稿ごとのいいね数をまとめて数え_0件の投稿は含まない() {
        Post other = data.post(hanako, "別の投稿");
        Post noLikes = data.post(hanako, "いいね0件");
        data.like(hanako, post);
        data.like(taro, post);
        data.like(taro, other);

        List<PostCount> counts = likeRepository.countByPostIds(List.of(post.getId(), other.getId(), noLikes.getId()));

        assertThat(counts).extracting(PostCount::getPostId, PostCount::getCount)
                .containsExactlyInAnyOrder(tuple(post.getId(), 2L), tuple(other.getId(), 1L));
    }

    @Test
    void findLikedPostIds_渡した投稿のうち自分がいいね済みのものだけを返す() {
        Post other = data.post(hanako, "別の投稿");
        Post notInList = data.post(hanako, "対象外");
        data.like(hanako, post);
        data.like(taro, other);
        data.like(hanako, notInList);

        assertThat(likeRepository.findLikedPostIds(hanako.getId(), List.of(post.getId(), other.getId())))
                .containsExactly(post.getId());
    }
}
