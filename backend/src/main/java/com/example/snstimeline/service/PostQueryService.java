package com.example.snstimeline.service;

import com.example.snstimeline.dto.NewPostsResponse;
import com.example.snstimeline.dto.PageResponse;
import com.example.snstimeline.dto.PostResponse;
import com.example.snstimeline.dto.PostResponse.AuthorResponse;
import com.example.snstimeline.dto.PostResponse.ImageResponse;
import com.example.snstimeline.entity.Post;
import com.example.snstimeline.repository.CommentRepository;
import com.example.snstimeline.repository.LikeRepository;
import com.example.snstimeline.repository.PostCount;
import com.example.snstimeline.repository.PostImageRepository;
import com.example.snstimeline.repository.PostRepository;
import com.example.snstimeline.service.storage.ImageStorage;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.data.domain.Limit;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 投稿の一覧取得と、画面に返す形(PostResponse)への組み立て。タイムライン・投稿詳細で共通。
 */
@Service
public class PostQueryService {

    static final int PAGE_SIZE = 20;

    private final PostRepository postRepository;
    private final LikeRepository likeRepository;
    private final CommentRepository commentRepository;
    private final PostImageRepository postImageRepository;
    private final ImageStorage imageStorage;

    public PostQueryService(PostRepository postRepository, LikeRepository likeRepository,
            CommentRepository commentRepository, PostImageRepository postImageRepository, ImageStorage imageStorage) {
        this.postRepository = postRepository;
        this.likeRepository = likeRepository;
        this.commentRepository = commentRepository;
        this.postImageRepository = postImageRepository;
        this.imageStorage = imageStorage;
    }

    /** T-01 タイムライン。cursor が null なら最新から取得する */
    @Transactional(readOnly = true)
    public PageResponse<PostResponse> timeline(Long me, Long cursor) {
        long before = cursor == null ? Long.MAX_VALUE : cursor;
        // 1件多く取得して、次のページがあるかを判定する
        return toPage(postRepository.findTimeline(me, before, Limit.of(PAGE_SIZE + 1)), me);
    }

    /** U-04 ユーザーの投稿一覧。組み立てはタイムラインと同じ。cursor が null なら最新から取得する */
    @Transactional(readOnly = true)
    public PageResponse<PostResponse> userPosts(Long me, Long userId, Long cursor) {
        long before = cursor == null ? Long.MAX_VALUE : cursor;
        return toPage(postRepository.findByAuthor(userId, before, Limit.of(PAGE_SIZE + 1)), me);
    }

    /** PAGE_SIZE + 1 件取得した結果から、20件と次のページがあるかを組み立てる */
    private PageResponse<PostResponse> toPage(List<Post> posts, Long me) {
        boolean hasNext = posts.size() > PAGE_SIZE;
        List<Post> page = hasNext ? posts.subList(0, PAGE_SIZE) : posts;
        Long nextCursor = hasNext ? page.getLast().getId() : null;
        return new PageResponse<>(toResponses(page, me), nextCursor, hasNext);
    }

    /** T-02 新着投稿。since より新しい投稿を最大20件返す */
    @Transactional(readOnly = true)
    public NewPostsResponse newPosts(Long me, long since) {
        List<Post> posts = postRepository.findTimelineSince(me, since, Limit.of(PAGE_SIZE + 1));
        boolean hasMore = posts.size() > PAGE_SIZE;
        List<Post> items = hasMore ? posts.subList(0, PAGE_SIZE) : posts;
        return new NewPostsResponse(toResponses(items, me), hasMore);
    }

    /**
     * 投稿の一覧を画面に返す形にする。いいね数・いいね済み・コメント数・画像は、投稿IDをまとめて渡して1回ずつで取得する
     * (N+1問題の回避、設計書 3-2・3-4)。投稿者は取得クエリの join fetch で取得済み。
     */
    public List<PostResponse> toResponses(List<Post> posts, Long me) {
        if (posts.isEmpty()) {
            return List.of();
        }
        List<Long> postIds = posts.stream().map(Post::getId).toList();
        Map<Long, Long> likeCounts = toMap(likeRepository.countByPostIds(postIds));
        Set<Long> likedPostIds = new HashSet<>(likeRepository.findLikedPostIds(me, postIds));
        Map<Long, Long> commentCounts = toMap(commentRepository.countByPostIds(postIds));
        // 取得クエリで表示順に並べてあるので、投稿IDごとに分けるだけでよい
        Map<Long, List<ImageResponse>> images = postImageRepository.findByPostIds(postIds).stream()
                .collect(Collectors.groupingBy(i -> i.getPost().getId(),
                        Collectors.mapping(i -> new ImageResponse(imageStorage.toUrl(i.getImageKey()), i.getSortOrder()),
                                Collectors.toList())));
        return posts.stream()
                .map(post -> toResponse(post, me,
                        images.getOrDefault(post.getId(), List.of()),
                        likeCounts.getOrDefault(post.getId(), 0L),
                        commentCounts.getOrDefault(post.getId(), 0L),
                        likedPostIds.contains(post.getId())))
                .toList();
    }

    public PostResponse toResponse(Post post, Long me) {
        return toResponses(List.of(post), me).getFirst();
    }

    private static Map<Long, Long> toMap(List<PostCount> counts) {
        return counts.stream().collect(Collectors.toMap(PostCount::getPostId, PostCount::getCount));
    }

    private PostResponse toResponse(Post post, Long me, List<ImageResponse> images, long likeCount,
            long commentCount, boolean likedByMe) {
        return new PostResponse(
                post.getId(),
                AuthorResponse.of(post.getUser(), imageStorage),
                post.getContent(),
                images,
                likeCount,
                commentCount,
                likedByMe,
                post.isWrittenBy(me),
                post.getEditedAt() != null,
                post.getCreatedAt());
    }
}
