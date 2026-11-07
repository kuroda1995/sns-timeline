package com.example.snstimeline.repository;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.example.snstimeline.entity.Post;
import com.example.snstimeline.entity.PostImage;
import com.example.snstimeline.entity.User;
import com.example.snstimeline.support.RepositoryTest;
import com.example.snstimeline.support.TestData;
import java.util.List;
import org.hibernate.exception.ConstraintViolationException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.jpa.test.autoconfigure.TestEntityManager;

@RepositoryTest
class PostImageRepositoryTest {

    @Autowired
    private PostImageRepository postImageRepository;

    @Autowired
    private TestEntityManager em;

    private TestData data;
    private User user;

    @BeforeEach
    void setUp() {
        data = new TestData(em);
        user = data.user("hanako");
    }

    @Test
    void findByPostIds_渡した投稿の画像を投稿ID順_表示順に返す() {
        Post p1 = data.post(user, "1");
        Post p2 = data.post(user, "2");
        Post other = data.post(user, "対象外");
        // 登録順と表示順をわざとずらす
        data.image(p2, "posts/p2-1.jpg", 1);
        data.image(p1, "posts/p1-2.jpg", 2);
        data.image(other, "posts/other.jpg", 1);
        data.image(p1, "posts/p1-1.jpg", 1);

        List<PostImage> images = postImageRepository.findByPostIds(List.of(p2.getId(), p1.getId()));

        assertThat(images).extracting(PostImage::getImageKey)
                .containsExactly("posts/p1-1.jpg", "posts/p1-2.jpg", "posts/p2-1.jpg");
    }

    @Test
    void existsByPostId_画像があるかを返す() {
        Post withImage = data.post(user, "画像あり");
        Post withoutImage = data.post(user, "画像なし");
        data.image(withImage, "posts/a.jpg", 1);

        assertThat(postImageRepository.existsByPostId(withImage.getId())).isTrue();
        assertThat(postImageRepository.existsByPostId(withoutImage.getId())).isFalse();
    }

    @Test
    void 同じ投稿で表示順が重複する画像は登録できない() {
        Post post = data.post(user, "a");
        data.image(post, "posts/a.jpg", 1);

        assertThatThrownBy(() -> data.image(post, "posts/b.jpg", 1))
                .isInstanceOf(ConstraintViolationException.class);
    }

    @Test
    void 表示順は1から4まで() {
        Post post = data.post(user, "a");
        data.image(post, "posts/4.jpg", 4);

        assertThatThrownBy(() -> data.image(post, "posts/5.jpg", 5))
                .rootCause()
                .hasMessageContaining("ck_post_images_order");
    }
}
