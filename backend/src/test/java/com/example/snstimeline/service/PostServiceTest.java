package com.example.snstimeline.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.matches;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.example.snstimeline.dto.PostResponse;
import com.example.snstimeline.entity.Post;
import com.example.snstimeline.entity.PostImage;
import com.example.snstimeline.entity.User;
import com.example.snstimeline.exception.ApiException;
import com.example.snstimeline.repository.CommentRepository;
import com.example.snstimeline.repository.LikeRepository;
import com.example.snstimeline.repository.PostImageRepository;
import com.example.snstimeline.repository.PostRepository;
import com.example.snstimeline.repository.UserRepository;
import com.example.snstimeline.service.storage.ImageStorage;
import com.example.snstimeline.service.storage.ImageValidator;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.multipart.MultipartFile;

class PostServiceTest {

    private static final long HANAKO_ID = 2L;
    private static final long TARO_ID = 3L;

    private PostRepository postRepository;
    private UserRepository userRepository;
    private PostImageRepository postImageRepository;
    private ImageStorage imageStorage;
    private PostService postService;
    private User hanako;

    @BeforeEach
    void setUp() {
        postRepository = mock(PostRepository.class);
        userRepository = mock(UserRepository.class);
        postImageRepository = mock(PostImageRepository.class);
        imageStorage = mock(ImageStorage.class);
        PostQueryService postQueryService = new PostQueryService(postRepository, mock(LikeRepository.class),
                mock(CommentRepository.class), postImageRepository, imageStorage);
        postService = new PostService(postRepository, userRepository, postImageRepository, postQueryService,
                new ImageValidator(), imageStorage);
        hanako = user(HANAKO_ID, "hanako");
        when(userRepository.findById(HANAKO_ID)).thenReturn(Optional.of(hanako));
        when(postRepository.saveAndFlush(any())).thenAnswer(inv -> inv.getArgument(0));
        // 保存キーは保存した順に key1, key2, ...
        AtomicInteger saved = new AtomicInteger();
        when(imageStorage.save(any(), anyString(), anyString()))
                .thenAnswer(inv -> "key" + saved.incrementAndGet() + "." + inv.getArgument(2));
    }

    /** テキストだけの投稿 */
    private PostResponse createText(String content) {
        return postService.create(HANAKO_ID, content, null);
    }

    /** 先頭のバイト列が PNG の画像ファイル */
    private static MockMultipartFile png(String name) {
        byte[] content = {(byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 0};
        return new MockMultipartFile("images", name, "image/png", content);
    }

    @SuppressWarnings("unchecked")
    private List<PostImage> savedImages() {
        ArgumentCaptor<List<PostImage>> captor = ArgumentCaptor.forClass(List.class);
        verify(postImageRepository).saveAllAndFlush(captor.capture());
        return captor.getValue();
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
        PostResponse response = createText("  \n 1行目\n2行目 \n ");

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

        createText(content);

        ArgumentCaptor<Post> captor = ArgumentCaptor.forClass(Post.class);
        verify(postRepository).saveAndFlush(captor.capture());
        assertThat(captor.getValue().getContent()).isEqualTo("あ".repeat(69) + "\n" + "あ".repeat(70));
    }

    @Test
    void create_140文字ちょうどは投稿でき141文字は400() {
        createText("あ".repeat(140));

        assertBadContent(() -> createText("あ".repeat(141)), "140文字以内で入力してください");
    }

    @Test
    void create_絵文字は1文字と数える() {
        // "👍".length() は2だが、見た目どおり1文字として数える
        createText("👍".repeat(140));

        assertBadContent(() -> createText("👍".repeat(141)), "140文字以内で入力してください");
    }

    @Test
    void create_空白や改行だけ_全角スペースだけ_未入力は400() {
        assertBadContent(() -> createText(" \n\t "), "本文を入力してください");
        assertBadContent(() -> createText("　　"), "本文を入力してください");
        assertBadContent(() -> createText(null), "本文を入力してください");
        verify(postRepository, never()).saveAndFlush(any());
    }

    @Test
    void create_画像は送った順に月ごとのフォルダへ保存し表示順1から記録する() {
        postService.create(HANAKO_ID, "旅行の写真", List.of(png("b.png"), png("a.png")));

        verify(imageStorage, times(2)).save(any(), matches("posts/\\d{4}/\\d{2}"), eq("png"));
        assertThat(savedImages()).extracting(PostImage::getImageKey).containsExactly("key1.png", "key2.png");
        assertThat(savedImages()).extracting(PostImage::getSortOrder).containsExactly(1, 2);
    }

    @Test
    void create_画像があれば本文は空でもよい_本文も画像も無いと400() {
        PostResponse response = postService.create(HANAKO_ID, "  ", List.of(png("a.png")));

        assertThat(response.content()).isEmpty();
        assertBadContent(() -> postService.create(HANAKO_ID, "  ", List.of()), "本文を入力してください");
    }

    @Test
    void create_画像が5枚以上なら400で何も保存しない() {
        List<MultipartFile> five = List.of(png("1.png"), png("2.png"), png("3.png"), png("4.png"), png("5.png"));

        assertThatThrownBy(() -> postService.create(HANAKO_ID, "本文", five))
                .isInstanceOfSatisfying(ApiException.class, e -> {
                    assertThat(e.getStatus()).isEqualTo(HttpStatus.BAD_REQUEST);
                    assertThat(e.getField()).isEqualTo("images");
                    assertThat(e.getMessage()).isEqualTo("画像は4枚まで添付できます");
                });
        verify(imageStorage, never()).save(any(), anyString(), anyString());
        verify(postRepository, never()).saveAndFlush(any());
    }

    @Test
    void create_拡張子だけjpgにした画像以外のファイルが混ざっていたら400で1枚も保存しない() {
        MockMultipartFile html = new MockMultipartFile("images", "evil.jpg", "image/jpeg",
                "<html><script>alert(1)</script></html>".getBytes());

        assertThatThrownBy(() -> postService.create(HANAKO_ID, "本文", List.of(png("a.png"), html)))
                .isInstanceOfSatisfying(ApiException.class,
                        e -> assertThat(e.getStatus()).isEqualTo(HttpStatus.BAD_REQUEST));
        verify(imageStorage, never()).save(any(), anyString(), anyString());
    }

    @Test
    void create_DBへの保存に失敗したら保存済みの画像ファイルを削除する() {
        when(postImageRepository.saveAllAndFlush(any())).thenThrow(new DataIntegrityViolationException("失敗"));

        assertThatThrownBy(() -> postService.create(HANAKO_ID, "本文", List.of(png("a.png"), png("b.png"))))
                .isInstanceOf(DataIntegrityViolationException.class);
        verify(imageStorage).delete("key1.png");
        verify(imageStorage).delete("key2.png");
    }

    @Test
    void update_画像付きの投稿は本文を空にできる_画像が無い投稿はできない() {
        Post withImages = postOf(hanako, 10L);
        when(postImageRepository.existsByPostId(10L)).thenReturn(true);
        postOf(hanako, 11L);

        postService.update(HANAKO_ID, 10L, "  ");

        assertThat(withImages.getContent()).isEmpty();
        assertBadContent(() -> postService.update(HANAKO_ID, 11L, "  "), "本文を入力してください");
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
