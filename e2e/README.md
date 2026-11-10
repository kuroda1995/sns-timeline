# E2Eテスト・ブラウザ性能テスト(e2e/)

[Playwright](https://playwright.dev/) で実際のブラウザ(Chromium)を操作し、画面 → API → DB までをつないだ状態で動きを確かめる。
考え方は [設計書 7-6](../設計書.md#7-6-e2eテスト) を参照。

| 種類 | 設定 | 対象 | 実行のタイミング |
|---|---|---|---|
| E2Eテスト | `playwright.config.js`(`tests/`) | 利用者の操作の流れ(シナリオ)と、シナリオで足りない観点 | **PRごとの CI**(`.github/workflows/ci.yml`)・手元で随時 |
| ブラウザ性能テスト | `playwright.perf.config.js`(`perf/`) | 画面に表示されるまで・押してから反応するまでの時間 | 手動(性能に関わる変更をしたとき)。手順は [perf/README.md](../perf/README.md#ブラウザ性能テスト) |

## ツールの選定

| 候補 | 判断 | 理由 |
|---|---|---|
| **Playwright** | ✅ 採用 | 1つのテストの中で**複数のユーザー(ブラウザのコンテキスト)を同時に動かせる**(SNSは「AがいいねするとBの画面に反映される」の確認が多い)。時計の差し替え(`page.clock`)で15秒ごとの新着確認を待たずに試せる。通信の差し替え(`page.route`)でエラー時の表示を再現できる。Chrome DevTools Protocol で回線・CPUを遅くして性能を測れる。テストの起動前にサーバーを起動する仕組み(`webServer`)がある。失敗時のトレース(操作ごとの画面・通信の記録)が見やすい |
| Cypress | 見送り | 1つのテストで1つのブラウザ(1ユーザー)しか動かせず、別タブ・複数ユーザーのやりとりが書きにくい。性能の計測や回線の制限は別のツールが必要 |
| Selenium / WebdriverIO | 見送り | できることは近いが、待ち合わせ(要素が出るまで待つ)を自分で書く必要があり、テストが不安定になりやすい。設定も多い |
| Lighthouse CI(性能) | 見送り | ページを開いたときの指標(LCP など)は測れるが、ログインした状態での操作(いいね・投稿・無限スクロール)の時間は測れない。同じ指標は Playwright の中で Performance API から取れるため、ツールを増やさない |

要件定義書 8章 No.1 で対応ブラウザを Chrome に絞っているため、ブラウザは Chromium だけで実行する(Firefox・Safari は対象外)。

## 構成

```
e2e/
├── playwright.config.js        # E2Eテストの設定(desktop: 1280×800 / mobile: 375×740)
├── playwright.perf.config.js   # ブラウザ性能テストの設定(desktop / slow-mobile)
├── docker-compose.e2e.yml      # E2E専用の PostgreSQL(ポート5434。開発用DB・性能テスト用DBとは別)
├── scripts/start-backend.mjs   # テスト用にバックエンドを起動する(bootJar → java -jar)
├── support/                    # 共通部分
│   ├── fixtures.js             # test・expect(ユーザーを作る・ログインした画面を開く・想定外のエラーやダイアログで失敗させる)
│   ├── api.js                  # テストデータをAPIで準備する
│   ├── ui.js                   # 画面の部品の探し方(ロール・ラベル・文字で探す)
│   ├── images.js               # アップロードする PNG を作る
│   ├── servers.js              # バックエンド・画面の起動(webServer)
│   └── env.js                  # URL・定数
├── tests/
│   ├── scenarios/              # シナリオテスト(利用者の操作の流れを通しで確かめる)
│   ├── auth.spec.js            # ログイン状態(失敗・ログアウト・無効なトークン・別タブ・サーバー停止)
│   ├── security.spec.js        # XSS・他人の投稿やコメントを操作できない
│   ├── resilience.spec.js      # 通信エラーのときの表示とやり直し・いいねの連打
│   ├── navigation.spec.js      # 無限スクロール・「戻る」・URLを直接開いたとき
│   └── responsive.spec.js      # スマートフォン幅(mobile プロジェクトでだけ実行)
└── perf/                       # ブラウザ性能テスト
    ├── browser-perf.spec.js
    └── support/                # 計測の仕組み・合否の基準(budgets.js)・結果の出力(perf-reporter.js)
```

## 実行する

### 準備(初回のみ)

1. `backend/.env` と `application-local.properties` を作成済みであること([README](../README.md#初回のみ設定ファイルの作成))
2. Docker Desktop を起動しておく
3. 依存関係とブラウザを入れる

```powershell
cd frontend; npm install; cd ..
cd e2e
npm install
npx playwright install chromium
```

### 実行手順(`e2e/` で実行する)

```powershell
# 1. E2E専用DBを起動する(開発用DBと同時に起動していてもよい)
npm run db:up

# 2. 開発サーバー(バックエンド 8080・画面 5173)を起動していたら止める(CLAUDE.md 5章。別のポートには逃がさない)

# 3. 実行する。バックエンド(local,e2e プロファイル)と画面(本番と同じビルド)は Playwright が起動し、終わったら止める
npx playwright test

# 失敗したテストのトレース(操作ごとの画面・通信)を見る
npx playwright show-report
```

| コマンド | 内容 |
|---|---|
| `npx playwright test tests/scenarios` | シナリオテストだけ |
| `npx playwright test -g "いいね"` | テスト名で絞る |
| `npx playwright test --ui` | 画面で1つずつ実行し、操作を目で確かめる(テストを書くときに便利) |
| `npx playwright test --headed` | ブラウザを表示して実行する |
| `npm run db:down` | E2E専用DBを止める(データはメモリ上にあるので、一緒に消える) |

- 1回の実行は約30秒(初回はバックエンドのビルドで1〜2分多くかかる)
- テストはそれぞれ自分専用のユーザー(`e2e_` で始まるユーザー名)を作るため、並列に実行でき、前回の実行のデータが残っていても影響しない
- 起動済みのサーバーをそのまま使いたいとき(バックエンドを `local,e2e` で自分で起動している等)は `E2E_REUSE_SERVERS=1` を付ける。**開発用DBにつながったバックエンドを使うと、開発用DBにテストのデータが溜まる**ので注意

## テストの一覧と観点

### シナリオテスト(`tests/scenarios/`)

[要件定義書 9章「完成の目安」](../要件定義書.md#9-完成の目安これができたら完成とする) の流れを、利用者の目線で通しで確かめる。

| ファイル | シナリオ | 機能ID |
|---|---|---|
| `first-time-user.spec.js` | 新規登録 → ユーザー検索 → フォロー → タイムラインでいいね・コメント → 読み込み直しても残る → **相手の画面にも反映される** | AUTH-01・SRCH-01・FLW-01・TL-01・LIKE-01・CMT-01 |
| `post-lifecycle.spec.js` | 画像2枚付きで投稿 → 拡大表示(左右キー・Esc) → 編集(編集済み) → 削除(キャンセル・OK) → 詳細URLは「削除されたか、存在しません」。本文140文字(絵文字)・画像4枚・形式・5MB・書きかけの破棄確認 | PST-01〜04・IMG-01〜04 |
| `new-posts.spec.js` | タイムラインを開いたまま、フォロー中の人の新しい投稿を受け取る(一番上なら自動で入る/読んでいる途中は「新しい投稿 N件」/自分の投稿は数えない) | TL-05 |
| `profile-and-follow.spec.js` | 表示名・自己紹介・アイコンの変更が、プロフィール・サイドメニュー・タイムラインに反映される。フォロー → フォロワー一覧 → フォロー解除(確認・キャンセル) | USER-01・02・FLW-01〜04 |

### シナリオで足りない観点

シナリオは「正しく使ったときの流れ」が中心で、次のことは通らない。ブラウザでしか確かめられないものに絞って追加した。

| ファイル | 観点 | 追加した理由 |
|---|---|---|
| `auth.spec.js` | ログイン失敗・入力チェック、ログイン前に開いた画面への復帰、ログアウト後の「戻る」、**別タブでのログアウトの反映**、無効なトークン、起動時にサーバーへつながらないとき | localStorage・別タブの `storage` イベント・ブラウザの履歴は jsdom では本物と同じに動かない |
| `security.spec.js` | 投稿・コメント・自己紹介・表示名に書いたHTML(`<script>`・`onerror`)が実行されない。他人の投稿・コメントに編集・削除ボタンが出ない | 要件定義書 8章 No.6・7。サーバーが保存した文字列を、実際のブラウザで表示して確かめる |
| `resilience.spec.js` | タイムライン・続きの読み込み・投稿の送信が失敗したときの表示とやり直し、いいね失敗時の巻き戻し、**いいねの連打で画面とサーバーがそろう**、操作中の401でログイン画面へ | 楽観的更新(押した瞬間に表示を変える)は、画面とサーバーの両方を見ないと正しさが分からない |
| `navigation.spec.js` | 無限スクロール(20件ずつ・重複や欠落が無い)、投稿詳細から「戻る」で一覧とスクロール位置が戻る、検索結果に「戻る」、存在しない投稿・ユーザー・URL | IntersectionObserver・スクロール位置・ブラウザの履歴は jsdom では動かない |
| `responsive.spec.js` | 幅375pxで主な画面に横スクロールが出ない(長い英数字・画像4枚)、下のメニューと ✏️ ボタンで操作できる | 要件定義書 8章 No.2。CSS が実際に適用された状態でしか分からない |

**どのテストでも**、画面のJavaScriptの例外・`console.error`・予告していない `alert`/`confirm` が出たら失敗にする(`support/fixtures.js`)。画面に出ない不具合も拾うため。

### E2Eでは確かめないこと(他のテストで確かめている)

- APIを直接呼んだときの認可(他人の投稿の編集は403など)・入力チェックの境界値の細かいパターン → バックエンドの `ApiIntegrationTest`・Controller のテスト
- コンポーネントごとの表示の細かい分岐 → フロントの Vitest
- 見た目のずれ(スクリーンショットの比較)→ OS(Windows と CI の Linux)でフォントの描画が違い、誤検知が多くなるため行わない
- アクセシビリティの自動チェック → 要件定義書 8章 No.14 で対象外

## テストの書き方のルール

- `@playwright/test` ではなく `support/fixtures.js` から `test`・`expect` を読み込む
- **テストしたい操作の前提はAPIで作る**(`api.signup()`・`api.createPost()` など)。画面の操作で作ると遅く、関係ない画面の変更でテストが壊れる
- ログインした画面は `openAs(ユーザー)` で開く(JWTを localStorage に入れた状態で開く)。ログイン画面の操作そのものを確かめるときだけ、`page` でログインする
- 部品は**ロール・ラベル・文字**で探す(`getByRole('button', { name: '投稿する' })`)。CSSのクラス名には頼らない。よく使うものは `support/ui.js` にまとめる
- `waitForTimeout`(決まった時間待つ)は使わない。`expect(...).toBeVisible()` などで「そうなるまで待つ」
- `confirm`・`alert` が出る操作は、先に `handleNextDialog(page, { accept: true })` で予告する
- 画面を移動した直後は、移動先の見出しなどが表示されるのを待ってから操作する。react-router は URL を先に変え、画面の切り替えを少し後に行うため、URLだけを待つと前の画面の部品を押してしまう
- テスト名は日本語で「何をしたら、どうなるべきか」を書く([設計書 7-3](../設計書.md#7-3-観点))

## 困ったとき

| 症状 | 対処 |
|---|---|
| `http://localhost:8080 is already used` | 開発用のバックエンドが起動している。止めてから実行する(別のポートには逃がさない) |
| バックエンドが起動しない(`Connection refused` など) | `npm run db:up` でE2E専用DBを起動したか確認する。`E2E_SERVER_LOG=1` を付けるとバックエンドのログも表示される |
| CI だけで失敗する | Actions の成果物 `e2e-report` をダウンロードし、`npx playwright show-report <展開したフォルダ>/playwright-report` でトレースを見る |
