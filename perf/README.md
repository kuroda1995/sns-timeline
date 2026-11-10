# 性能テスト(perf/)

[k6](https://grafana.com/docs/k6/latest/) で API に負荷をかけ、[要件定義書 8章](../要件定義書.md#8-非機能要件) の性能要件を満たしているかを確かめる。
考え方は [設計書 7-5](../設計書.md#7-5-性能テスト) を参照。

**CI では実行しない。** `./gradlew test`・`npm test`・`.github/workflows/ci.yml` とは関係なく、必要なときに手動で実行する。
(実行の目安: 性能に関わる変更(タイムラインのクエリ・インデックス・N+1対策など)をしたとき、AWSへデプロイしたとき)

## 構成

```
perf/
├── docker-compose.perf.yml   # 性能テスト専用の PostgreSQL(ポート5433。開発用DBとは別)
├── seed/seed.sql             # テストデータの投入(全件削除してから作り直す)
├── k6/
│   ├── lib/config.js         # 接続先・合否の基準(thresholds)
│   ├── lib/api.js            # APIの呼び出し(API の No を name タグに付ける)
│   └── scenarios/
│       ├── smoke.js          # 1人で全APIを1回ずつ。スクリプトとデータの確認用
│       └── load.js           # 100人が同時に使う状態を再現し、合否を判定する
└── results/                  # 計測結果の出力先(Gitに含めない)
```

## 合否の基準(`k6/lib/config.js`)

| 対象 | 基準 | 根拠 |
|---|---|---|
| T-01 タイムライン | p95 < 500ms | 要件定義書 8章 No.4「タイムラインの表示が1秒以内」。画面の描画の時間を残す |
| T-02 新着確認 | p95 < 200ms | 全員が15秒ごとに呼ぶAPI(要件定義書 8-1) |
| 全API | p95 < 1000ms | |
| エラー率 | < 1% | |

p95 は「95%のリクエストがこの時間以内に返った」という値。平均だと一部の遅いリクエストが隠れるため、p95 で判定する。

## 準備(初回のみ)

1. k6 をインストールする: `winget install k6 --source winget`(Mac は `brew install k6`)
2. Docker Desktop を起動しておく
3. `backend/.env` と `application-local.properties` を作成済みであること([README](../README.md#初回のみ設定ファイルの作成))

## 実行手順

コマンドはすべてリポジトリのルートで、PowerShell で実行する。
(Git Bash では `/seed/seed.sql` が Windows のパスに変換されてしまうため、`MSYS_NO_PATHCONV=1` を付ける)

```powershell
# 1. 性能テスト専用DBを起動する(開発用DBと同時に起動していてもよい)
docker compose --env-file backend/.env -f perf/docker-compose.perf.yml up -d

# 2. バックエンドを perf プロファイルで起動する(接続先が専用DBになる。テーブルもここで作られる)
#    ポートは 8080 のまま。開発用のバックエンドが起動中なら先に止める
cd backend; ./gradlew.bat bootRun --args='--spring.profiles.active=local,perf'

# 3. (別のターミナルで)テストデータを投入する。全件削除してから作り直すので、計測の前に毎回実行する
docker exec sns-timeline-perf-postgres psql -U sns_timeline -d sns_timeline_perf -f /seed/seed.sql

# 4. smoke: スクリプトとデータが正しいか確かめる(数秒)
k6 run perf/k6/scenarios/smoke.js

# 5. load: 本番相当の負荷で計測する(約10分)。結果を perf/results/ に保存する
$env:K6_WEB_DASHBOARD = "true"; $env:K6_WEB_DASHBOARD_EXPORT = "perf/results/load-report.html"
k6 run --summary-export perf/results/load-summary.json perf/k6/scenarios/load.js
```

### オプション

| 指定 | 内容 | 例 |
|---|---|---|
| `-e BASE_URL=...` | 接続先(既定: `http://localhost:8080`) | AWS では ALB のURL |
| `-e VUS=...` | 同時に使う人数(既定: 100) | `-e VUS=30` |
| `-e HOLD=...` | 全員が使い続ける時間(既定: `8m`) | `-e HOLD=3m` |
| `-e USER_COUNT=...` | seed で作ったユーザー数(既定: 100) | `scale=10` で投入したら `1000` |
| `-e PERF_PASSWORD=...` | seed で設定したパスワード(既定: `perfpass123`) | |
| seed の `-v scale=10` | 10倍のデータ(1000人・10万投稿)を作る | `... -f /seed/seed.sql -v scale=10` |

## 結果の見方

- ターミナルの最後に出る `THRESHOLDS` の各行に ✓ / ✗ が付く。1つでも ✗ があれば終了コードが非0になる
- 合否は setup() のログイン(A-02)を除いた、シナリオ中のリクエストだけで判定する(BCrypt でわざと遅くしている処理のため)
- `http_req_duration{name:T-01}` のように、API の No(設計書 4-2)ごとに集計される
- `perf/results/load-report.html` をブラウザで開くと、時間ごとのレスポンス時間・リクエスト数のグラフが見られる
- 実行中は `http://localhost:5665` でリアルタイムのグラフも見られる(`K6_WEB_DASHBOARD=true` のとき)

### 遅かったときに調べること

```powershell
# 合計時間の長いSQL(seed.sql の最後で記録をリセットしているので、計測中のSQLだけが出る)
docker exec sns-timeline-perf-postgres psql -U sns_timeline -d sns_timeline_perf -c "SELECT calls, round(total_exec_time) AS total_ms, round(mean_exec_time::numeric, 2) AS mean_ms, left(query, 120) AS query FROM pg_stat_statements ORDER BY total_exec_time DESC LIMIT 10;"

# DB接続プールの待ち(1以上なら接続が足りずに待っている)。<JWT> は smoke などでログインして取ったもの
curl.exe -H "Authorization: Bearer <JWT>" http://localhost:8080/api/metrics/hikaricp.connections.pending
```

- バックエンドのアクセスログ(`http.access`)の `durationMs` で、サーバー内でかかった時間が分かる。k6 の時間との差は通信の時間
- SQLの実行計画は `EXPLAIN ANALYZE` で確かめる(例: [設計書 3-1](../設計書.md#3-1-タイムラインフォロー中のユーザー自分の投稿) のタイムラインのSQL)

## 注意

- ローカルでの計測値はPCの性能に左右されるため目安。**変更の前後を同じPCで比べる**のに使う。要件を満たすかの最終判定はAWS(フェーズ2)で行う
- AWS に対して実行するのは課金に関わるため、実行する前に必ず確認する。`t3.micro` は CPU クレジット制のため、長時間の負荷で遅くなることがある
- 開発用DB(`sns_timeline`)には seed.sql を実行しない(SQLの中でDB名を確認して止めるようにしている)
- 後片付け: `docker compose --env-file backend/.env -f perf/docker-compose.perf.yml down`(データも消すなら `-v` を付ける)
