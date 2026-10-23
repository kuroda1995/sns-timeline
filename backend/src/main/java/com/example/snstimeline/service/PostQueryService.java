package com.example.snstimeline.service;

import com.example.snstimeline.dto.NewPostsResponse;
import com.example.snstimeline.dto.PageResponse;
import com.example.snstimeline.dto.PostResponse;
import com.example.snstimeline.dto.PostResponse.AuthorResponse;
import com.example.snstimeline.entity.Post;
import com.example.snstimeline.entity.User;
import com.example.snstimeline.repository.PostRepository;
import java.util.List;
import org.springframework.data.domain.Limit;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 投稿の一覧取得と、画面に返す形(PostResponse)への組み立て。タイムライン・投稿詳細で共通。
 * いいね数・コメント数・画像は、それぞれの機能を実装するときに投稿IDをまとめて渡して取得する(設計書 3-2)。
 */
@Service
public class PostQueryService {

    static final int PAGE_SIZE = 20;

    private final PostRepository postRepository;

    public PostQueryService(PostRepository postRepository) {
        this.postRepository = postRepository;
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

    public List<PostResponse> toResponses(List<Post> posts, Long me) {
        return posts.stream().map(post -> toResponse(post, me)).toList();
    }

    public PostResponse toResponse(Post post, Long me) {
        User author = post.getUser();
        // avatarUrl は画像保存(ImageStorage)の実装時に avatar_key から組み立てる
        AuthorResponse authorResponse =
                new AuthorResponse(author.getId(), author.getUsername(), author.getDisplayName(), null);
        return new PostResponse(
                post.getId(),
                authorResponse,
                post.getContent(),
                List.of(),
                0,
                0,
                false,
                post.isWrittenBy(me),
                post.getEditedAt() != null,
                post.getCreatedAt());
    }
}
