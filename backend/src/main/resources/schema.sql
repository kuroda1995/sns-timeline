-- Hibernate(ddl-auto=update)では関数インデックスを作れないため、ここで作成する。
-- spring.jpa.defer-datasource-initialization=true により、テーブル作成後に毎回実行される。

-- Taro と taro を別人として登録できないようにする(設計書 2-1)
CREATE UNIQUE INDEX IF NOT EXISTS uq_users_username_lower ON users (LOWER(username));
CREATE UNIQUE INDEX IF NOT EXISTS uq_users_email_lower ON users (LOWER(email));
-- 「新しく参加したユーザー」の表示用
CREATE INDEX IF NOT EXISTS idx_users_created ON users (created_at);
