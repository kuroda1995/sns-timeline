package com.example.snstimeline.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.example.snstimeline.dto.CommentCountResponse;
import com.example.snstimeline.dto.CommentResponse;
import com.example.snstimeline.dto.CreateCommentResponse;
import com.example.snstimeline.dto.PageResponse;
import com.example.snstimeline.entity.Comment;
import com.example.snstimeline.entity.Post;
import com.example.snstimeline.entity.User;
import com.example.snstimeline.exception.ApiException;
import com.example.snstimeline.repository.CommentRepository;
import com.example.snstimeline.repository.PostRepository;
import com.example.snstimeline.repository.UserRepository;
import java.util.List;
import java.util.Optional;
import java.util.stream.LongStream;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.domain.Limit;
import org.springframework.http.HttpStatus;
import org.springframework.test.util.ReflectionTestUtils;

class CommentServiceTest {

    private static final long HANAKO_ID = 2L;
    private static final long TARO_ID = 3L;
    private static final long POST_ID = 120L;

    private CommentRepository commentRepository;
    private PostRepository postRepository;
    private UserRepository userRepository;
    private CommentService commentService;
    private User hanako;
    private User taro;
    private Post post;

    @BeforeEach
    void setUp() {
        commentRepository = mock(CommentRepository.class);
        postRepository = mock(PostRepository.class);
        userRepository = mock(UserRepository.class);
        commentService = new CommentService(commentRepository, postRepository, userRepository);
        hanako = user(HANAKO_ID, "hanako");
        taro = user(TARO_ID, "taro");
        // 投稿者は太郎
        post = new Post(taro, "投稿の本文");
        ReflectionTestUtils.setField(post, "id", POST_ID);
        when(postRepository.existsByIdAndDeletedAtIsNull(POST_ID)).thenReturn(true);
        when(postRepository.getReferenceById(POST_ID)).thenReturn(post);
        when(userRepository.findById(HANAKO_ID)).thenReturn(Optional.of(hanako));
        when(commentRepository.saveAndFlush(any())).thenAnswer(inv -> inv.getArgument(0));
    }

    private static User user(long id, String username) {
        User user = new User(username, username + "@example.com", "hash", username);
        ReflectionTestUtils.setField(user, "id", id);
        return user;
    }

    private Comment commentOf(User author, long commentId) {
        Comment comment = new Comment(post, author, "コメント" + commentId);
        ReflectionTestUtils.setField(comment, "id", commentId);
        return comment;
    }

    private static void assertStatus(Runnable action, HttpStatus status) {
        assertThatThrownBy(action::run).isInstanceOfSatisfying(ApiException.class,
                e -> assertThat(e.getStatus()).isEqualTo(status));
    }

    @Test
    void list_cursorが無ければ最初から古い順に取得し自分のコメントだけisMineにする() {
        when(commentRepository.findPage(POST_ID, 0L, Limit.of(21)))
                .thenReturn(List.of(commentOf(taro, 501), commentOf(hanako, 502)));

        PageResponse<CommentResponse> page = commentService.list(HANAKO_ID, POST_ID, null);

        assertThat(page.items()).extracting(CommentResponse::id).containsExactly(501L, 502L);
        assertThat(page.items()).extracting(CommentResponse::isMine).containsExactly(false, true);
        assertThat(page.items().getFirst().author().username()).isEqualTo("taro");
        assertThat(page.hasNext()).isFalse();
        assertThat(page.nextCursor()).isNull();
    }

    @Test
    void list_21件取れたら20件だけ返し最後のコメントIDを次のcursorにする() {
        List<Comment> comments = LongStream.rangeClosed(11, 31).mapToObj(id -> commentOf(taro, id)).toList();
        when(commentRepository.findPage(POST_ID, 10L, Limit.of(21))).thenReturn(comments);

        PageResponse<CommentResponse> page = commentService.list(HANAKO_ID, POST_ID, 10L);

        assertThat(page.items()).hasSize(20);
        assertThat(page.hasNext()).isTrue();
        assertThat(page.nextCursor()).isEqualTo(30L);
    }

    @Test
    void list_削除済みの投稿は404() {
        when(postRepository.existsByIdAndDeletedAtIsNull(99L)).thenReturn(false);

        assertStatus(() -> commentService.list(HANAKO_ID, 99L, null), HttpStatus.NOT_FOUND);
    }

    @Test
    void create_他人の投稿にコメントでき前後の空白を取り除いて保存し最新のコメント数を返す() {
        when(commentRepository.countByPostIdAndDeletedAtIsNull(POST_ID)).thenReturn(13L);

        CreateCommentResponse response = commentService.create(HANAKO_ID, POST_ID, "  参考になります！\n ");

        ArgumentCaptor<Comment> captor = ArgumentCaptor.forClass(Comment.class);
        verify(commentRepository).saveAndFlush(captor.capture());
        assertThat(captor.getValue().getContent()).isEqualTo("参考になります！");
        assertThat(captor.getValue().getPost()).isSameAs(post);
        assertThat(response.comment().isMine()).isTrue();
        assertThat(response.comment().author().username()).isEqualTo("hanako");
        assertThat(response.commentCount()).isEqualTo(13L);
    }

    @Test
    void create_入力チェックは投稿と同じ() {
        commentService.create(HANAKO_ID, POST_ID, "👍".repeat(140));

        assertStatus(() -> commentService.create(HANAKO_ID, POST_ID, "あ".repeat(141)), HttpStatus.BAD_REQUEST);
        assertStatus(() -> commentService.create(HANAKO_ID, POST_ID, " \n　"), HttpStatus.BAD_REQUEST);
        assertStatus(() -> commentService.create(HANAKO_ID, POST_ID, null), HttpStatus.BAD_REQUEST);
    }

    @Test
    void create_削除済みの投稿には404でコメントしない() {
        when(postRepository.existsByIdAndDeletedAtIsNull(99L)).thenReturn(false);

        assertStatus(() -> commentService.create(HANAKO_ID, 99L, "コメント"), HttpStatus.NOT_FOUND);
        verify(commentRepository, never()).saveAndFlush(any());
    }

    @Test
    void delete_自分のコメントは論理削除して最新のコメント数を返す() {
        Comment comment = commentOf(hanako, 501);
        when(commentRepository.findVisibleById(501L)).thenReturn(Optional.of(comment));
        when(commentRepository.countByPostIdAndDeletedAtIsNull(POST_ID)).thenReturn(12L);

        CommentCountResponse response = commentService.delete(HANAKO_ID, 501L);

        assertThat(comment.getDeletedAt()).isNotNull();
        verify(commentRepository, never()).delete(any());
        assertThat(response.commentCount()).isEqualTo(12L);
    }

    @Test
    void delete_投稿者本人でも他人のコメントは403で削除しない() {
        // 投稿者の太郎が、花子のコメントを削除しようとする
        Comment comment = commentOf(hanako, 501);
        when(commentRepository.findVisibleById(501L)).thenReturn(Optional.of(comment));

        assertThatThrownBy(() -> commentService.delete(TARO_ID, 501L))
                .isInstanceOfSatisfying(ApiException.class, e -> {
                    assertThat(e.getStatus()).isEqualTo(HttpStatus.FORBIDDEN);
                    assertThat(e.getMessage()).isEqualTo("このコメントは削除できません");
                });
        assertThat(comment.getDeletedAt()).isNull();
    }

    @Test
    void delete_存在しないか削除済みのコメントは404() {
        when(commentRepository.findVisibleById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> commentService.delete(HANAKO_ID, 99L))
                .isInstanceOfSatisfying(ApiException.class, e -> {
                    assertThat(e.getStatus()).isEqualTo(HttpStatus.NOT_FOUND);
                    assertThat(e.getMessage()).isEqualTo(CommentService.NOT_FOUND_MESSAGE);
                });
    }
}
