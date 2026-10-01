---
name: dev-servers
description: このプロジェクト(sns-timeline)のバックエンド(Spring Boot, ポート8080)とフロントエンド(Vite, ポート5173)の開発サーバーを起動・停止する。ポートは常に固定のデフォルトポートを使う。競合時は別ポートに逃げず、占有しているプロセスを止めてから指定ポートで起動し直す。
---

# 開発サーバーの起動ルール

## 絶対厳守: ポートを変えて起動しない

- バックエンド: **8080固定**(`backend/src/main/resources/application.properties` の `server.port=8080`)
- フロントエンド: **5173固定**(`frontend/vite.config.js` に `server.strictPort: true` を設定する。ポートが埋まっていると自動で別ポートへ逃げず、起動自体が失敗する)

**理由**: バックエンドの `backend/src/main/java/com/example/snstimeline/config/CorsConfig.java` は
`http://localhost:5173` からのリクエストしか許可しない。フロントを別ポート(5174など)で
起動すると、API呼び出しがすべてCORSエラーになり、ログイン・タイムラインが動かない。
「とりあえず空いてる別ポートで起動する」は絶対にNG。ポートが埋まっていたら、
**そのポートを使っているプロセスを止めてから、同じ指定ポートで起動し直す**こと。

## 起動手順

1. Postgresの起動確認
   ```bash
   docker ps --filter "name=sns-timeline-postgres" --format "{{.Status}}"
   ```
   動いていなければ `cd backend && docker compose up -d`。

2. ポート8080の競合チェック(Windows / PowerShell)
   ```powershell
   Get-NetTCPConnection -LocalPort 8080 -State Listen -ErrorAction SilentlyContinue |
     Select-Object -ExpandProperty OwningProcess
   ```
   PIDが返ってきたら `Stop-Process -Id <PID> -Force` で停止し、
   `curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/api/health` が
   接続不可(`000`)になったことを確認してから次に進む。

3. バックエンド起動
   ```bash
   cd backend && ./gradlew bootRun --args='--spring.profiles.active=local'
   ```
   ログに `Started SnsTimelineApplication` が出るまで待つ。
   `curl -s http://localhost:8080/api/health` で `{"status":"UP"}` が返ることを確認する。
   `Port 8080 was already in use` のエラーが出たら手順2に戻る(**ポートは変えない**)。

4. ポート5173の競合チェック(手順2と同様に `Get-NetTCPConnection -LocalPort 5173 ...` で確認し、
   必要なら該当PIDを停止)

5. フロントエンド起動
   ```bash
   cd frontend && npm run dev
   ```
   `strictPort: true` のため、5173が埋まっていると起動自体が失敗する(自動で5174等にはならない)。
   失敗したら手順4に戻る(**ポートは変えない**)。

## 停止するとき

- バックエンド/フロントエンドとも、該当ポートのPIDを特定して `Stop-Process -Id <PID> -Force`(PowerShell)
- Postgres(`sns-timeline-postgres`コンテナ)は他の作業でも使い回すため、明示的に頼まれない限り停止しない
- `backend/uploads/`(ローカル保存した画像)は、明示的に頼まれない限り削除しない
