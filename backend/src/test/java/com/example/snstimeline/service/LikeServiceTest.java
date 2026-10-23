package com.example.snstimeline.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.example.snstimeline.dto.LikeResponse;
import com.example.snstimeline.exception.ApiException;
import com.example.snstimeline.repository.LikeRepository;
import com.example.snstimeline.repository.PostRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

class LikeServiceTest {

    private static final long ME = 2L;
    private static final long POST_ID = 120L;

    private LikeRepository likeRepository;
    private PostRepository postRepository;
    private LikeService likeService;

    @BeforeEach
    void setUp() {
        likeRepository = mock(LikeRepository.class);
        postRepository = mock(PostRepository.class);
        likeService = new LikeService(likeRepository, postRepository);
        when(postRepository.existsByIdAndDeletedAtIsNull(POST_ID)).thenReturn(true);
    }

    @Test
    void like_登録して他の人の分も含めた最新のいいね数を返す() {
        when(likeRepository.countByPostId(POST_ID)).thenReturn(36L);

        LikeResponse response = likeService.like(ME, POST_ID);

        verify(likeRepository).insertIfAbsent(ME, POST_ID);
        assertThat(response.likeCount()).isEqualTo(36L);
        assertThat(response.likedByMe()).isTrue();
    }

    @Test
    void like_いいね済みで何も登録されなくても成功として扱う() {
        // ON CONFLICT DO NOTHING で登録件数が0
        when(likeRepository.insertIfAbsent(ME, POST_ID)).thenReturn(0);
        when(likeRepository.countByPostId(POST_ID)).thenReturn(35L);

        LikeResponse response = likeService.like(ME, POST_ID);

        assertThat(response.likeCount()).isEqualTo(35L);
        assertThat(response.likedByMe()).isTrue();
    }

    @Test
    void unlike_削除して最新のいいね数を返す_いいねしていなくても成功() {
        when(likeRepository.deleteByUserIdAndPostId(ME, POST_ID)).thenReturn(0);
        when(likeRepository.countByPostId(POST_ID)).thenReturn(34L);

        LikeResponse response = likeService.unlike(ME, POST_ID);

        verify(likeRepository).deleteByUserIdAndPostId(ME, POST_ID);
        assertThat(response.likeCount()).isEqualTo(34L);
        assertThat(response.likedByMe()).isFalse();
    }

    @Test
    void like_unlike_存在しないか削除済みの投稿は404で何もしない() {
        when(postRepository.existsByIdAndDeletedAtIsNull(99L)).thenReturn(false);

        assertThatThrownBy(() -> likeService.like(ME, 99L))
                .isInstanceOfSatisfying(ApiException.class, e -> {
                    assertThat(e.getStatus()).isEqualTo(HttpStatus.NOT_FOUND);
                    assertThat(e.getMessage()).isEqualTo(PostService.NOT_FOUND_MESSAGE);
                });
        assertThatThrownBy(() -> likeService.unlike(ME, 99L))
                .isInstanceOfSatisfying(ApiException.class,
                        e -> assertThat(e.getStatus()).isEqualTo(HttpStatus.NOT_FOUND));
        verify(likeRepository, never()).insertIfAbsent(anyLong(), anyLong());
        verify(likeRepository, never()).deleteByUserIdAndPostId(anyLong(), anyLong());
    }
}
