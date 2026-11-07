package com.example.snstimeline.service;

import com.example.snstimeline.dto.CommentCountResponse;
import com.example.snstimeline.dto.CommentResponse;
import com.example.snstimeline.dto.CreateCommentResponse;
import com.example.snstimeline.dto.PageResponse;
import com.example.snstimeline.dto.PostResponse.AuthorResponse;
import com.example.snstimeline.entity.Comment;
import com.example.snstimeline.entity.User;
import com.example.snstimeline.exception.ApiException;
import com.example.snstimeline.logging.LogFields;
import com.example.snstimeline.repository.CommentRepository;
import com.example.snstimeline.repository.PostRepository;
import com.example.snstimeline.repository.UserRepository;
import com.example.snstimeline.service.storage.ImageStorage;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Limit;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** コメントの一覧・投稿・削除(コメント機能 CMT-01〜04) */
@Service
public class CommentService {

    static final int PAGE_SIZE = 20;
    static final String NOT_FOUND_MESSAGE = "このコメントは削除されたか、存在しません";

    private static final Logger log = LoggerFactory.getLogger(CommentService.class);

    private final CommentRepository commentRepository;
    private final PostRepository postRepository;
    private final UserRepository userRepository;
    private final ImageStorage imageStorage;

    public CommentService(CommentRepository commentRepository, PostRepository postRepository,
            UserRepository userRepository, ImageStorage imageStorage) {
        this.commentRepository = commentRepository;
        this.postRepository = postRepository;
        this.userRepository = userRepository;
        this.imageStorage = imageStorage;
    }

    /** C-01 コメント一覧。古い順に20件ずつ。cursor が null なら最初から取得する */
    @Transactional(readOnly = true)
    public PageResponse<CommentResponse> list(Long me, Long postId, Long cursor) {
        ensurePostVisible(postId);
        long after = cursor == null ? 0 : cursor;
        // 1件多く取得して、次のページがあるかを判定する
        List<Comment> comments = commentRepository.findPage(postId, after, Limit.of(PAGE_SIZE + 1));
        boolean hasNext = comments.size() > PAGE_SIZE;
        List<Comment> page = hasNext ? comments.subList(0, PAGE_SIZE) : comments;
        Long nextCursor = hasNext ? page.getLast().getId() : null;
        return new PageResponse<>(page.stream().map(c -> toResponse(c, me)).toList(), nextCursor, hasNext);
    }

    /** C-02 コメント投稿。入力チェックは投稿と同じ(1〜140文字) */
    @Transactional
    public CreateCommentResponse create(Long me, Long postId, String content) {
        String normalized = ContentRules.normalize(content);
        ensurePostVisible(postId);
        User author = userRepository.findById(me)
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "ログインしてください"));
        Comment comment = commentRepository.saveAndFlush(
                new Comment(postRepository.getReferenceById(postId), author, normalized));
        log.atInfo().setMessage("コメントしました").addKeyValue(LogFields.EVENT, "comment.created")
                .addKeyValue("commentId", comment.getId()).addKeyValue("postId", postId).log();
        return new CreateCommentResponse(toResponse(comment, me), commentRepository.countByPostIdAndDeletedAtIsNull(postId));
    }

    /** C-03 コメント削除(本人のみ・論理削除)。投稿者本人でも、他人のコメントは削除できない */
    @Transactional
    public CommentCountResponse delete(Long me, Long commentId) {
        Comment comment = commentRepository.findVisibleById(commentId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, NOT_FOUND_MESSAGE));
        // 画面のボタンを隠すだけでなく、サーバー側で本人のコメントか確認する(処理のルール No.2)
        if (!comment.isWrittenBy(me)) {
            throw new ApiException(HttpStatus.FORBIDDEN, "このコメントは削除できません");
        }
        comment.delete();
        // 削除を反映してから数える
        commentRepository.flush();
        log.atInfo().setMessage("コメントを削除しました").addKeyValue(LogFields.EVENT, "comment.deleted")
                .addKeyValue("commentId", commentId).log();
        return new CommentCountResponse(commentRepository.countByPostIdAndDeletedAtIsNull(comment.getPost().getId()));
    }

    /** 削除済みの投稿にはコメントできず、コメントも見られない(処理のルール No.3) */
    private void ensurePostVisible(Long postId) {
        if (!postRepository.existsByIdAndDeletedAtIsNull(postId)) {
            throw new ApiException(HttpStatus.NOT_FOUND, PostService.NOT_FOUND_MESSAGE);
        }
    }

    private CommentResponse toResponse(Comment comment, Long me) {
        return new CommentResponse(
                comment.getId(),
                AuthorResponse.of(comment.getUser(), imageStorage),
                comment.getContent(),
                comment.isWrittenBy(me),
                comment.getCreatedAt());
    }
}
