package com.example.snstimeline.service;

import com.example.snstimeline.dto.NewPostsResponse;
import com.example.snstimeline.dto.PageResponse;
import com.example.snstimeline.dto.PostResponse;
import com.example.snstimeline.dto.PostResponse.AuthorResponse;
import com.example.snstimeline.entity.Post;
import com.example.snstimeline.entity.User;
import com.example.snstimeline.repository.LikeRepository;
import com.example.snstimeline.repository.PostCount;
import com.example.snstimeline.repository.PostRepository;
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
 * コメント数・画像は、それぞれの機能を実装するときに、いいねと同じく投稿IDをまとめて渡して取得する(設計書 3-2)。
 */
@Service
public class PostQueryService {

    static final int PAGE_SIZE = 20;

    private final PostRepository postRepository;
    private final LikeRepository likeRepository;

    public PostQueryService(PostRepository postRepository, LikeRepository likeRepository) {
        this.postRepository = postRepository;
        this.likeRepository = likeRepository;
    }

    /** T-01 タイムライン。cursor が null なら最新から取得する */
    @Transactional(readOnly = true)
    public PageResponse<PostResponse> timeline(Long me, Long cursor) {
        long before = cursor == null ? Long.MAX_VALUE : cursor;
        // 1件多く取得して、次のページがあるかを判定する
        List<Post> posts = postRepository.findTimeline(me, before, Limit.of(PAGE_SIZE + 1));
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
     * 投稿の一覧を画面に返す形にする。いいね数・いいね済みは、投稿IDをまとめて渡して1回ずつで取得する
     * (N+1問題の回避、設計書 3-2・3-4)。投稿者は取得クエリの join fetch で取得済み。
     */
    public List<PostResponse> toResponses(List<Post> posts, Long me) {
        if (posts.isEmpty()) {
            return List.of();
        }
        List<Long> postIds = posts.stream().map(Post::getId).toList();
        Map<Long, Long> likeCounts = likeRepository.countByPostIds(postIds).stream()
                .collect(Collectors.toMap(PostCount::getPostId, PostCount::getCount));
        Set<Long> likedPostIds = new HashSet<>(likeRepository.findLikedPostIds(me, postIds));
        return posts.stream()
                .map(post -> toResponse(post, me,
                        likeCounts.getOrDefault(post.getId(), 0L), likedPostIds.contains(post.getId())))
                .toList();
    }

    public PostResponse toResponse(Post post, Long me) {
        return toResponses(List.of(post), me).getFirst();
    }

    private static PostResponse toResponse(Post post, Long me, long likeCount, boolean likedByMe) {
        User author = post.getUser();
        // avatarUrl は画像保存(ImageStorage)の実装時に avatar_key から組み立てる
        AuthorResponse authorResponse =
                new AuthorResponse(author.getId(), author.getUsername(), author.getDisplayName(), null);
        return new PostResponse(
                post.getId(),
                authorResponse,
                post.getContent(),
                List.of(),
                likeCount,
                0,
                likedByMe,
                post.isWrittenBy(me),
                post.getEditedAt() != null,
                post.getCreatedAt());
    }
}
