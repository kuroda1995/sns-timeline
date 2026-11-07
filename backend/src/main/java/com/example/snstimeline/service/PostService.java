package com.example.snstimeline.service;

import com.example.snstimeline.dto.PostResponse;
import com.example.snstimeline.entity.Post;
import com.example.snstimeline.entity.PostImage;
import com.example.snstimeline.entity.User;
import com.example.snstimeline.exception.ApiException;
import com.example.snstimeline.logging.LogFields;
import com.example.snstimeline.repository.PostImageRepository;
import com.example.snstimeline.repository.PostRepository;
import com.example.snstimeline.repository.UserRepository;
import com.example.snstimeline.service.storage.ImageStorage;
import com.example.snstimeline.service.storage.ImageValidator;
import com.example.snstimeline.service.storage.ImageValidator.ValidatedImage;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

/** 投稿の作成・取得・編集・削除(投稿機能 PST-01〜04、画像投稿機能 IMG-01) */
@Service
public class PostService {

    static final String NOT_FOUND_MESSAGE = "この投稿は削除されたか、存在しません";
    static final int MAX_IMAGES = 4;

    private static final Logger log = LoggerFactory.getLogger(PostService.class);

    private final PostRepository postRepository;
    private final UserRepository userRepository;
    private final PostImageRepository postImageRepository;
    private final PostQueryService postQueryService;
    private final ImageValidator imageValidator;
    private final ImageStorage imageStorage;

    public PostService(PostRepository postRepository, UserRepository userRepository,
            PostImageRepository postImageRepository, PostQueryService postQueryService,
            ImageValidator imageValidator, ImageStorage imageStorage) {
        this.postRepository = postRepository;
        this.userRepository = userRepository;
        this.postImageRepository = postImageRepository;
        this.postQueryService = postQueryService;
        this.imageValidator = imageValidator;
        this.imageStorage = imageStorage;
    }

    /**
     * P-01 投稿作成。画像は最大4枚で、画像があれば本文は空でもよい。
     * 画像を保存してから投稿をDBに保存し、DBへの保存に失敗したら保存済みの画像を削除する
     * (「投稿はあるのに画像が無い」「使われない画像が残る」を防ぐ、画像投稿機能 処理のルール No.4・5)。
     */
    @Transactional
    public PostResponse create(Long me, String content, List<MultipartFile> images) {
        List<MultipartFile> files = images == null ? List.of() : images;
        if (files.size() > MAX_IMAGES) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "画像は4枚まで添付できます", "images");
        }
        String normalized = files.isEmpty()
                ? ContentRules.normalize(content)
                : ContentRules.normalizeAllowingEmpty(content);
        // 1枚でも不正なら、何も保存しないうちに止める
        List<ValidatedImage> validated = files.stream().map(f -> imageValidator.validate(f, "images")).toList();
        User author = userRepository.findById(me)
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "ログインしてください"));

        List<String> savedKeys = new ArrayList<>();
        try {
            // 保存先は月ごとのフォルダに分ける(例: posts/2026/10)
            String directory = "posts/" + YearMonth.now().toString().replace('-', '/');
            for (ValidatedImage image : validated) {
                savedKeys.add(imageStorage.save(image.content(), directory, image.type().extension()));
            }
            Post post = postRepository.saveAndFlush(new Post(author, normalized));
            List<PostImage> postImages = new ArrayList<>();
            for (int i = 0; i < savedKeys.size(); i++) {
                postImages.add(new PostImage(post, savedKeys.get(i), i + 1));
            }
            // flush してここでSQLを実行し、DBのエラーをこの try の中で受け取る
            postImageRepository.saveAllAndFlush(postImages);
            // 本文はユーザーが書いた内容なのでログに出さず、IDと画像の枚数だけを出す(設計書 8-4)
            log.atInfo().setMessage("投稿しました").addKeyValue(LogFields.EVENT, "post.created")
                    .addKeyValue("postId", post.getId()).addKeyValue("imageCount", savedKeys.size()).log();
            return postQueryService.toResponse(post, me);
        } catch (RuntimeException e) {
            savedKeys.forEach(imageStorage::delete);
            throw e;
        }
    }

    /** P-02 投稿詳細 */
    @Transactional(readOnly = true)
    public PostResponse get(Long me, Long postId) {
        return postQueryService.toResponse(findVisible(postId), me);
    }

    /** P-04 投稿編集(本人のみ)。編集できるのは本文だけ。画像付きの投稿なら本文を空にしてもよい(作成と同じルール) */
    @Transactional
    public PostResponse update(Long me, Long postId, String content) {
        Post post = findOwnPost(me, postId, "この投稿は編集できません");
        String normalized = postImageRepository.existsByPostId(postId)
                ? ContentRules.normalizeAllowingEmpty(content)
                : ContentRules.normalize(content);
        post.edit(normalized);
        postRepository.flush();
        log.atInfo().setMessage("投稿を編集しました").addKeyValue(LogFields.EVENT, "post.updated")
                .addKeyValue("postId", postId).log();
        return postQueryService.toResponse(post, me);
    }

    /** P-03 投稿削除(本人のみ・論理削除)。付いていた画像の行・ファイルは残す(投稿機能 処理のルール No.4) */
    @Transactional
    public void delete(Long me, Long postId) {
        findOwnPost(me, postId, "この投稿は削除できません").delete();
        log.atInfo().setMessage("投稿を削除しました").addKeyValue(LogFields.EVENT, "post.deleted")
                .addKeyValue("postId", postId).log();
    }

    private Post findVisible(Long postId) {
        return postRepository.findVisibleById(postId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, NOT_FOUND_MESSAGE));
    }

    /** 画面のボタンを隠すだけでなく、サーバー側で本人の投稿か確認する(処理のルール No.5) */
    private Post findOwnPost(Long me, Long postId, String forbiddenMessage) {
        Post post = findVisible(postId);
        if (!post.isWrittenBy(me)) {
            throw new ApiException(HttpStatus.FORBIDDEN, forbiddenMessage);
        }
        return post;
    }
}
