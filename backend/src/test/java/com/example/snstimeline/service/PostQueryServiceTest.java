package com.example.snstimeline.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.example.snstimeline.dto.NewPostsResponse;
import com.example.snstimeline.dto.PageResponse;
import com.example.snstimeline.dto.PostResponse;
import com.example.snstimeline.entity.Post;
import com.example.snstimeline.entity.User;
import com.example.snstimeline.repository.CommentRepository;
import com.example.snstimeline.repository.LikeRepository;
import com.example.snstimeline.repository.PostCount;
import com.example.snstimeline.repository.PostRepository;
import java.util.List;
import java.util.stream.LongStream;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.Limit;
import org.springframework.test.util.ReflectionTestUtils;

class PostQueryServiceTest {

    private static final long ME = 2L;

    private PostRepository postRepository;
    private LikeRepository likeRepository;
    private CommentRepository commentRepository;
    private PostQueryService postQueryService;
    private User me;

    @BeforeEach
    void setUp() {
        postRepository = mock(PostRepository.class);
        likeRepository = mock(LikeRepository.class);
        commentRepository = mock(CommentRepository.class);
        postQueryService = new PostQueryService(postRepository, likeRepository, commentRepository);
        me = new User("hanako", "hanako@example.com", "hash", "花子");
        ReflectionTestUtils.setField(me, "id", ME);
    }

    /** from から1ずつ小さくなるIDの投稿を count 件作る(新しい順) */
    private List<Post> postsFrom(long from, int count) {
        return LongStream.range(0, count).mapToObj(i -> {
            Post post = new Post(me, "本文" + (from - i));
            ReflectionTestUtils.setField(post, "id", from - i);
            return post;
        }).toList();
    }

    @Test
    void timeline_cursorが無ければ最新から取得する() {
        when(postRepository.findTimeline(eq(ME), anyLong(), eq(Limit.of(21)))).thenReturn(postsFrom(5, 5));

        PageResponse<PostResponse> page = postQueryService.timeline(ME, null);

        verify(postRepository).findTimeline(ME, Long.MAX_VALUE, Limit.of(21));
        assertThat(page.items()).hasSize(5);
        assertThat(page.hasNext()).isFalse();
        assertThat(page.nextCursor()).isNull();
    }

    @Test
    void timeline_21件取れたら20件だけ返し最後の投稿IDを次のcursorにする() {
        when(postRepository.findTimeline(ME, 101L, Limit.of(21))).thenReturn(postsFrom(100, 21));

        PageResponse<PostResponse> page = postQueryService.timeline(ME, 101L);

        assertThat(page.items()).hasSize(20);
        assertThat(page.items().getFirst().id()).isEqualTo(100L);
        assertThat(page.hasNext()).isTrue();
        assertThat(page.nextCursor()).isEqualTo(81L);
    }

    @Test
    void timeline_ちょうど20件なら次のページは無い() {
        when(postRepository.findTimeline(ME, Long.MAX_VALUE, Limit.of(21))).thenReturn(postsFrom(20, 20));

        PageResponse<PostResponse> page = postQueryService.timeline(ME, null);

        assertThat(page.items()).hasSize(20);
        assertThat(page.hasNext()).isFalse();
        assertThat(page.nextCursor()).isNull();
    }

    @Test
    void newPosts_20件を超えて溜まっていたらhasMoreをtrueにする() {
        when(postRepository.findTimelineSince(ME, 10L, Limit.of(21))).thenReturn(postsFrom(31, 21));

        NewPostsResponse response = postQueryService.newPosts(ME, 10L);

        assertThat(response.items()).hasSize(20);
        assertThat(response.hasMore()).isTrue();
    }

    @Test
    void newPosts_新着が無ければ空() {
        when(postRepository.findTimelineSince(ME, 10L, Limit.of(21))).thenReturn(List.of());

        NewPostsResponse response = postQueryService.newPosts(ME, 10L);

        assertThat(response.items()).isEmpty();
        assertThat(response.hasMore()).isFalse();
        // 投稿が0件なら集計のSQLは発行しない(空の IN () にしない)
        verifyNoInteractions(likeRepository, commentRepository);
    }

    private static PostCount count(long postId, long count) {
        return new PostCount() {
            @Override
            public Long getPostId() {
                return postId;
            }

            @Override
            public long getCount() {
                return count;
            }
        };
    }

    @Test
    void toResponses_いいね数といいね済みとコメント数を投稿IDまとめて1回ずつで取得する() {
        List<Post> posts = postsFrom(3, 3);
        List<Long> ids = List.of(3L, 2L, 1L);
        when(likeRepository.countByPostIds(ids)).thenReturn(List.of(count(3, 5), count(1, 1)));
        when(likeRepository.findLikedPostIds(ME, ids)).thenReturn(List.of(3L));
        when(commentRepository.countByPostIds(ids)).thenReturn(List.of(count(2, 4)));

        List<PostResponse> responses = postQueryService.toResponses(posts, ME);

        assertThat(responses).extracting(PostResponse::likeCount).containsExactly(5L, 0L, 1L);
        assertThat(responses).extracting(PostResponse::likedByMe).containsExactly(true, false, false);
        assertThat(responses).extracting(PostResponse::commentCount).containsExactly(0L, 4L, 0L);
        // N+1問題の回避: 投稿の件数に関係なく、集計はそれぞれ1回だけ
        verify(likeRepository, times(1)).countByPostIds(any());
        verify(likeRepository, times(1)).findLikedPostIds(anyLong(), any());
        verify(commentRepository, times(1)).countByPostIds(any());
    }
}
