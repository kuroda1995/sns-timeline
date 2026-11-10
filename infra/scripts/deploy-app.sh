#!/usr/bin/env bash
# アプリ(バックエンドのイメージ・フロントのビルド結果)を AWS に配置する(インフラ構成図 10章)。
# terraform apply で環境を作った後に、リポジトリのルートで実行する:  bash infra/scripts/deploy-app.sh
#
# 1. バックエンド: Docker イメージを作って ECR に push し、ECS のタスクを新しいイメージで入れ替える
# 2. フロント:     npm run build の結果を S3 にアップロードし、CloudFront のキャッシュを削除する
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
tf() { terraform -chdir="$ROOT/infra" output -raw "$1"; }

REGION="$(aws configure get region || echo ap-northeast-1)"
ECR_URL="$(tf ecr_repository_url)"
CLUSTER="$(tf ecs_cluster)"
SERVICE="$(tf ecs_service)"
BUCKET="$(tf frontend_bucket)"
DIST_ID="$(tf cloudfront_distribution_id)"
APP_URL="$(tf app_url)"
TAG="$(git -C "$ROOT" rev-parse --short HEAD)"

echo "== 1. バックエンド: イメージを作って ECR に push する(タグ: $TAG, latest)"
aws ecr get-login-password --region "$REGION" | docker login --username AWS --password-stdin "${ECR_URL%%/*}"
docker build --platform linux/amd64 -t "$ECR_URL:$TAG" -t "$ECR_URL:latest" "$ROOT/backend"
docker push "$ECR_URL:$TAG"
docker push "$ECR_URL:latest"

echo "== ECS のタスクを新しいイメージで入れ替える(タスク定義は latest タグを参照している)"
aws ecs update-service --cluster "$CLUSTER" --service "$SERVICE" --force-new-deployment --query 'service.serviceName' --output text

echo "== 2. フロント: ビルドして S3 にアップロードする"
# VITE_API_BASE_URL は指定しない。本番ビルドでは API を同じオリジン(CloudFront の /api/*)に送る(src/api/http.js)
(cd "$ROOT/frontend" && npm ci && npm run build)
# ファイル名にハッシュが付く assets/ は1年キャッシュ、index.html は毎回確認させる(新しい画面がすぐ届くように)
aws s3 sync "$ROOT/frontend/dist/assets" "s3://$BUCKET/assets" --delete --cache-control "public, max-age=31536000, immutable"
aws s3 sync "$ROOT/frontend/dist" "s3://$BUCKET" --delete --exclude "assets/*" --cache-control "no-cache"
# MSYS_NO_PATHCONV: Windows の Git Bash が "/index.html" を C:/Program Files/Git/index.html に書き換えないようにする
MSYS_NO_PATHCONV=1 aws cloudfront create-invalidation --distribution-id "$DIST_ID" --paths "/index.html" --query 'Invalidation.Id' --output text

echo "== ECS のタスクの入れ替えが終わるのを待つ(数分かかる)"
aws ecs wait services-stable --cluster "$CLUSTER" --services "$SERVICE"

echo "完了: $APP_URL"
