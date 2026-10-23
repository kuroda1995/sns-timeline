-- Hibernate(ddl-auto=update)では関数インデックスを作れないため、ここで作成する。
-- spring.jpa.defer-datasource-initialization=true により、テーブル作成後に毎回実行される。

-- Taro と taro を別人として登録できないようにする(設計書 2-1)
CREATE UNIQUE INDEX IF NOT EXISTS uq_users_username_lower ON users (LOWER(username));
CREATE UNIQUE INDEX IF NOT EXISTS uq_users_email_lower ON users (LOWER(email));
-- 「新しく参加したユーザー」の表示用
CREATE INDEX IF NOT EXISTS idx_users_created ON users (created_at);

-- タイムライン・プロフィールの投稿一覧を新しい順に取り出す用(設計書 2-2)
CREATE INDEX IF NOT EXISTS idx_posts_user_id ON posts (user_id, id DESC);
-- 投稿ごとのいいね数を数える用(設計書 2-4)
CREATE INDEX IF NOT EXISTS idx_likes_post ON likes (post_id);
-- 投稿詳細のコメント一覧(古い順)とコメント数を数える用(設計書 2-5)
CREATE INDEX IF NOT EXISTS idx_comments_post ON comments (post_id, id);
-- フォロワー一覧・フォロワー数を取り出す用(設計書 2-6)
CREATE INDEX IF NOT EXISTS idx_follows_followee ON follows (followee_id);
