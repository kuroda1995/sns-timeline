-- 性能テスト用のデータを投入する(設計書 7-5)。
-- 実行すると、性能テスト専用DBの全データを削除してから作り直す。開発用DBには絶対に実行しないこと。
--
-- テーブルは Spring Boot(ddl-auto=update)が作るため、先に perf プロファイルでバックエンドを1回起動しておく。
-- 実行方法(リポジトリのルートで):
--   docker exec sns-timeline-perf-postgres psql -U sns_timeline -d sns_timeline_perf -f /seed/seed.sql
-- 変数:
--   scale    … 倍率。1 で ユーザー100人・投稿1万件(要件定義書 8章 No.3 の想定規模)。10 で1000人・10万件
--   password … 全ユーザー共通のパスワード(k6 の PERF_PASSWORD と同じにする)
--   例: ... -f /seed/seed.sql -v scale=10

\set ON_ERROR_STOP on
\if :{?scale}
\else
  \set scale 1
\endif
\if :{?password}
\else
  \set password perfpass123
\endif

-- 開発用DBに実行してしまうのを防ぐ(エラーにして、終了コードも非0にする)
DO $$
BEGIN
    IF current_database() <> 'sns_timeline_perf' THEN
        RAISE EXCEPTION 'このSQLは性能テスト専用DB(sns_timeline_perf)にだけ実行できます(現在: %)', current_database();
    END IF;
    IF to_regclass('public.posts') IS NULL THEN
        RAISE EXCEPTION 'テーブルがありません。先に perf プロファイルでバックエンドを1回起動してください';
    END IF;
END
$$;

SELECT 100 * :scale AS user_count, 10000 * :scale AS post_count \gset
\echo 'ユーザー' :user_count '人、投稿' :post_count '件のデータを作ります'

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

TRUNCATE likes, comments, post_images, follows, posts, users RESTART IDENTITY CASCADE;

-- ===== ユーザー =====
-- BCrypt は1件ごとに時間がかかるため、ハッシュは1回だけ作って全員に同じ値を入れる
-- (アプリと同じ強度10。Spring の BCryptPasswordEncoder は $2a$ 形式も検証できる)
SELECT crypt(:'password', gen_salt('bf', 10)) AS password_hash \gset

-- メールアドレスは perf_u00001@example.com 〜。ID は 1〜user_count になる
INSERT INTO users (username, email, password_hash, display_name, bio, created_at, updated_at)
SELECT format('perf_u%s', lpad(g::text, 5, '0')),
       format('perf_u%s@example.com', lpad(g::text, 5, '0')),
       :'password_hash',
       format('性能テスト %s', g),
       '',
       now() - make_interval(hours => :user_count - g),
       now() - make_interval(hours => :user_count - g)
FROM generate_series(1, :user_count) AS g;

-- ===== フォロー =====
-- 1人あたり0〜50人をランダムにフォローする(フォロー数にばらつきを持たせる)
INSERT INTO follows (follower_id, followee_id, created_at)
SELECT u.id, t.id, now()
FROM users u
CROSS JOIN LATERAL (
    SELECT o.id FROM users o
    WHERE o.id <> u.id
    ORDER BY random()
    LIMIT floor(random() * 51)::int
) AS t;

-- ===== 投稿 =====
-- ID が大きいほど新しい投稿にする(1分おき)。投稿者はIDの小さいユーザーに偏らせ、よく投稿する人とあまり投稿しない人を作る
-- 約3%を編集済み、約2%を削除済み(論理削除)にする
INSERT INTO posts (user_id, content, created_at, updated_at, edited_at, deleted_at)
SELECT 1 + floor(power(random(), 2) * :user_count)::int,
       format('性能テスト用の投稿 #%s です。タイムラインの表示速度を測るためのデータです。', g),
       t.ts,
       t.ts,
       CASE WHEN random() < 0.03 THEN t.ts END,
       CASE WHEN random() < 0.02 THEN t.ts END
FROM generate_series(1, :post_count) AS g
CROSS JOIN LATERAL (SELECT now() - make_interval(mins => :post_count - g) AS ts) AS t;

-- ===== いいね =====
-- 投稿数の5倍の組み合わせを作り、重複(同じ人が同じ投稿に2回)は捨てる。新しい投稿ほどいいねが多くなるように偏らせる
INSERT INTO likes (user_id, post_id, created_at)
SELECT 1 + floor(random() * :user_count)::int,
       1 + floor(sqrt(random()) * :post_count)::int,
       now()
FROM generate_series(1, :post_count * 5)
ON CONFLICT DO NOTHING;

-- ===== コメント =====
-- 投稿数の2倍。約2%を削除済みにする
INSERT INTO comments (post_id, user_id, content, created_at, updated_at, deleted_at)
SELECT 1 + floor(sqrt(random()) * :post_count)::int,
       1 + floor(random() * :user_count)::int,
       format('性能テスト用のコメント #%s', g),
       now(),
       now(),
       CASE WHEN random() < 0.02 THEN now() END
FROM generate_series(1, :post_count * 2) AS g;

-- 統計情報を更新し、実行計画が実際の件数に合うようにする
VACUUM ANALYZE;

SELECT 'users' AS "テーブル", count(*) AS "件数" FROM users
UNION ALL SELECT 'follows', count(*) FROM follows
UNION ALL SELECT 'posts', count(*) FROM posts
UNION ALL SELECT 'likes', count(*) FROM likes
UNION ALL SELECT 'comments', count(*) FROM comments;

-- 投入時のSQLを計測結果に混ぜない(最後に実行する)
SELECT pg_stat_statements_reset() IS NOT NULL AS "SQLの記録をリセット";
