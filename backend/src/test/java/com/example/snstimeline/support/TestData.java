package com.example.snstimeline.support;

import com.example.snstimeline.entity.Comment;
import com.example.snstimeline.entity.Follow;
import com.example.snstimeline.entity.Post;
import com.example.snstimeline.entity.PostImage;
import com.example.snstimeline.entity.User;
import java.time.Instant;
import org.springframework.boot.jpa.test.autoconfigure.TestEntityManager;

/**
 * Repository のテストで使うデータを登録する。
 * ID は IDENTITY で登録順に振られるため、後に登録したものほど「新しい」データになる。
 */
public class TestData {

    private final TestEntityManager em;

    public TestData(TestEntityManager em) {
        this.em = em;
    }

    public User user(String username) {
        return user(username, username);
    }

    public User user(String username, String displayName) {
        return em.persistAndFlush(new User(username, username.toLowerCase() + "@example.com", "hash", displayName));
    }

    public Post post(User author, String content) {
        return em.persistAndFlush(new Post(author, content));
    }

    public Post deletedPost(User author, String content) {
        Post post = new Post(author, content);
        post.delete();
        return em.persistAndFlush(post);
    }

    public Follow follow(User follower, User followee) {
        return em.persistAndFlush(new Follow(follower, followee));
    }

    public Comment comment(Post post, User author, String content) {
        return em.persistAndFlush(new Comment(post, author, content));
    }

    public Comment deletedComment(Post post, User author, String content) {
        Comment comment = new Comment(post, author, content);
        comment.delete();
        return em.persistAndFlush(comment);
    }

    public PostImage image(Post post, String imageKey, int sortOrder) {
        return em.persistAndFlush(new PostImage(post, imageKey, sortOrder));
    }

    /** いいねはエンティティを new しない設計(PostLike のコメント参照)のため、SQLで登録する */
    public void like(User user, Post post) {
        em.getEntityManager()
                .createNativeQuery("insert into likes (user_id, post_id, created_at) values (?, ?, now())")
                .setParameter(1, user.getId())
                .setParameter(2, post.getId())
                .executeUpdate();
    }

    /** created_at は @CreationTimestamp で自動的に入るため、並び順を確かめるときはSQLで書き換える */
    public void setUserCreatedAt(User user, Instant createdAt) {
        em.getEntityManager()
                .createNativeQuery("update users set created_at = ? where id = ?")
                .setParameter(1, createdAt)
                .setParameter(2, user.getId())
                .executeUpdate();
    }

    /** 1次キャッシュを空にし、次の検索で必ずDBから読み直すようにする(join fetch の確認などで使う) */
    public void clear() {
        em.flush();
        em.clear();
    }
}
