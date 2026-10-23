package com.example.snstimeline.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.example.snstimeline.dto.PostResponse;
import com.example.snstimeline.entity.Post;
import com.example.snstimeline.entity.User;
import com.example.snstimeline.exception.ApiException;
import com.example.snstimeline.repository.LikeRepository;
import com.example.snstimeline.repository.PostRepository;
import com.example.snstimeline.repository.UserRepository;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.http.HttpStatus;
import org.springframework.test.util.ReflectionTestUtils;

class PostServiceTest {

    private static final long HANAKO_ID = 2L;
    private static final long TARO_ID = 3L;

    private PostRepository postRepository;
    private UserRepository userRepository;
    private PostService postService;
    private User hanako;

    @BeforeEach
    void setUp() {
        postRepository = mock(PostRepository.class);
        userRepository = mock(UserRepository.class);
        postService = new PostService(postRepository, userRepository,
                new PostQueryService(postRepository, mock(LikeRepository.class)));
        hanako = user(HANAKO_ID, "hanako");
        when(userRepository.findById(HANAKO_ID)).thenReturn(Optional.of(hanako));
        when(postRepository.saveAndFlush(any())).thenAnswer(inv -> inv.getArgument(0));
    }

    private static User user(long id, String username) {
        User user = new User(username, username + "@example.com", "hash", username);
        ReflectionTestUtils.setField(user, "id", id);
        return user;
    }

    private Post postOf(User author, long postId) {
        Post post = new Post(author, "元の本文");
        ReflectionTestUtils.setField(post, "id", postId);
        when(postRepository.findVisibleById(postId)).thenReturn(Optional.of(post));
        return post;
    }

    private static void assertBadContent(Runnable action, String message) {
        assertThatThrownBy(action::run).isInstanceOfSatisfying(ApiException.class, e -> {
            assertThat(e.getStatus()).isEqualTo(HttpStatus.BAD_REQUEST);
            assertThat(e.getField()).isEqualTo("content");
            assertThat(e.getMessage()).isEqualTo(message);
        });
    }

    @Test
    void create_前後の空白と改行を取り除き途中の改行は残して保存する() {
        PostResponse response = postService.create(HANAKO_ID, "  \n 1行目\n2行目 \n ");

        ArgumentCaptor<Post> captor = ArgumentCaptor.forClass(Post.class);
        verify(postRepository).saveAndFlush(captor.capture());
        assertThat(captor.getValue().getContent()).isEqualTo("1行目\n2行目");
        assertThat(response.isMine()).isTrue();
        assertThat(response.edited()).isFalse();
        assertThat(response.author().username()).isEqualTo("hanako");
    }

    @Test
    void create_ブラウザが送るCRLFの改行はLFにそろえて1文字と数える() {
        // 「あ」69文字 + 改行 + 「あ」70文字 = 画面上は140文字(CRLFのままだと141文字になる)
        String content = "あ".repeat(69) + "\r\n" + "あ".repeat(70);

        postService.create(HANAKO_ID, content);

        ArgumentCaptor<Post> captor = ArgumentCaptor.forClass(Post.class);
        verify(postRepository).saveAndFlush(captor.capture());
        assertThat(captor.getValue().getContent()).isEqualTo("あ".repeat(69) + "\n" + "あ".repeat(70));
    }

    @Test
    void create_140文字ちょうどは投稿でき141文字は400() {
        postService.create(HANAKO_ID, "あ".repeat(140));

        assertBadContent(() -> postService.create(HANAKO_ID, "あ".repeat(141)), "140文字以内で入力してください");
    }

    @Test
    void create_絵文字は1文字と数える() {
        // "👍".length() は2だが、見た目どおり1文字として数える
        postService.create(HANAKO_ID, "👍".repeat(140));

        assertBadContent(() -> postService.create(HANAKO_ID, "👍".repeat(141)), "140文字以内で入力してください");
    }

    @Test
    void create_空白や改行だけ_全角スペースだけ_未入力は400() {
        assertBadContent(() -> postService.create(HANAKO_ID, " \n\t "), "本文を入力してください");
        assertBadContent(() -> postService.create(HANAKO_ID, "　　"), "本文を入力してください");
        assertBadContent(() -> postService.create(HANAKO_ID, null), "本文を入力してください");
        verify(postRepository, never()).saveAndFlush(any());
    }

    @Test
    void get_他人の投稿はisMineがfalse() {
        postOf(user(TARO_ID, "taro"), 10L);

        PostResponse response = postService.get(HANAKO_ID, 10L);

        assertThat(response.isMine()).isFalse();
        assertThat(response.author().username()).isEqualTo("taro");
    }

    @Test
    void get_存在しないか削除済みの投稿は404() {
        when(postRepository.findVisibleById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> postService.get(HANAKO_ID, 99L))
                .isInstanceOfSatisfying(ApiException.class, e -> {
                    assertThat(e.getStatus()).isEqualTo(HttpStatus.NOT_FOUND);
                    assertThat(e.getMessage()).isEqualTo(PostService.NOT_FOUND_MESSAGE);
                });
    }

    @Test
    void update_自分の投稿は本文を書き換えて編集済みにする() {

        Post post = postOf(hanako, 10L);

        PostResponse response = postService.update(HANAKO_ID, 10L, " 書き換えた本文 ");

        assertThat(post.getContent()).isEqualTo("書き換えた本文");
        assertThat(post.getEditedAt()).isNotNull();
        assertThat(response.edited()).isTrue();
        assertThat(response.content()).isEqualTo("書き換えた本文");
    }

    @Test
    void update_他人の投稿は403で書き換えない() {
        Post post = postOf(user(TARO_ID, "taro"), 10L);

        assertThatThrownBy(() -> postService.update(HANAKO_ID, 10L, "乗っ取り"))
                .isInstanceOfSatisfying(ApiException.class,
                        e -> assertThat(e.getStatus()).isEqualTo(HttpStatus.FORBIDDEN));
        assertThat(post.getContent()).isEqualTo("元の本文");
        assertThat(post.getEditedAt()).isNull();
    }

    @Test
    void update_入力チェックは投稿作成と同じ() {
        postOf(hanako, 10L);

        assertBadContent(() -> postService.update(HANAKO_ID, 10L, "  "), "本文を入力してください");
        assertBadContent(() -> postService.update(HANAKO_ID, 10L, "あ".repeat(141)), "140文字以内で入力してください");
    }

    @Test
    void delete_自分の投稿は論理削除する() {
        Post post = postOf(hanako, 10L);

        postService.delete(HANAKO_ID, 10L);

        assertThat(post.getDeletedAt()).isNotNull();
        verify(postRepository, never()).delete(any());
    }

    @Test
    void delete_他人の投稿は403で削除しない() {
        Post post = postOf(user(TARO_ID, "taro"), 10L);

        assertThatThrownBy(() -> postService.delete(HANAKO_ID, 10L))
                .isInstanceOfSatisfying(ApiException.class, e -> {
                    assertThat(e.getStatus()).isEqualTo(HttpStatus.FORBIDDEN);
                    assertThat(e.getMessage()).isEqualTo("この投稿は削除できません");
                });
        assertThat(post.getDeletedAt()).isNull();
    }

    @Test
    void delete_削除済みの投稿は404() {
        when(postRepository.findVisibleById(10L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> postService.delete(HANAKO_ID, 10L))
                .isInstanceOfSatisfying(ApiException.class,
                        e -> assertThat(e.getStatus()).isEqualTo(HttpStatus.NOT_FOUND));
    }
}
