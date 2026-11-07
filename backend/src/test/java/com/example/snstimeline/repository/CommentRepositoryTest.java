package com.example.snstimeline.repository;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;

import com.example.snstimeline.entity.Comment;
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
class CommentRepositoryTest {

    @Autowired
    private CommentRepository commentRepository;

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
        post = data.post(taro, "コメントされる投稿");
    }

    private static List<Long> ids(List<Comment> comments) {
        return comments.stream().map(Comment::getId).toList();
    }

    @Test
    void findPage_投稿のコメントを古い順にコメント者と一緒に取得し_削除済みと他の投稿のコメントは含まない() {
        Comment c1 = data.comment(post, hanako, "1つ目");
        data.deletedComment(post, hanako, "削除済み");
        data.comment(data.post(hanako, "別の投稿"), taro, "別の投稿へのコメント");
        Comment c2 = data.comment(post, taro, "2つ目");
        data.clear();

        List<Comment> comments = commentRepository.findPage(post.getId(), 0, Limit.of(10));

        assertThat(ids(comments)).containsExactly(c1.getId(), c2.getId());
        assertThat(comments).allMatch(c -> Hibernate.isInitialized(c.getUser()));
        assertThat(comments).extracting(c -> c.getUser().getUsername()).containsExactly("hanako", "taro");
    }

    @Test
    void findPage_cursorより新しいコメントをlimit件だけ返す() {
        Comment c1 = data.comment(post, hanako, "1");
        Comment c2 = data.comment(post, hanako, "2");
        Comment c3 = data.comment(post, hanako, "3");

        assertThat(ids(commentRepository.findPage(post.getId(), 0, Limit.of(2))))
                .containsExactly(c1.getId(), c2.getId());
        assertThat(ids(commentRepository.findPage(post.getId(), c2.getId(), Limit.of(2))))
                .containsExactly(c3.getId());
    }

    @Test
    void findVisibleById_削除済みのコメントと_削除済みの投稿へのコメントは取得しない() {
        Comment visible = data.comment(post, hanako, "表示中");
        Comment deleted = data.deletedComment(post, hanako, "削除済み");
        Post deletedPost = data.deletedPost(taro, "削除済みの投稿");
        Comment onDeletedPost = data.comment(deletedPost, hanako, "削除済みの投稿へのコメント");

        assertThat(commentRepository.findVisibleById(visible.getId())).isPresent();
        assertThat(commentRepository.findVisibleById(deleted.getId())).isEmpty();
        assertThat(commentRepository.findVisibleById(onDeletedPost.getId())).isEmpty();
    }

    @Test
    void countByPostIdAndDeletedAtIsNull_削除済みのコメントは数えない() {
        data.comment(post, hanako, "1");
        data.comment(post, taro, "2");
        data.deletedComment(post, hanako, "削除済み");

        assertThat(commentRepository.countByPostIdAndDeletedAtIsNull(post.getId())).isEqualTo(2);
    }

    @Test
    void countByPostIds_投稿ごとのコメント数をまとめて数え_0件の投稿は含まない() {
        Post other = data.post(hanako, "別の投稿");
        Post onlyDeleted = data.post(hanako, "削除済みのコメントだけ");
        data.comment(post, hanako, "1");
        data.comment(post, taro, "2");
        data.comment(other, taro, "3");
        data.deletedComment(onlyDeleted, taro, "削除済み");

        List<PostCount> counts = commentRepository.countByPostIds(
                List.of(post.getId(), other.getId(), onlyDeleted.getId()));

        assertThat(counts).extracting(PostCount::getPostId, PostCount::getCount)
                .containsExactlyInAnyOrder(tuple(post.getId(), 2L), tuple(other.getId(), 1L));
    }
}
