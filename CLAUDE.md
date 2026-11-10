# GitHub運用ルール(Claude Code 厳守事項)

このリポジトリ(sns-timeline)で作業するときは、以下のルールを必ず守ること。ユーザーから明示的に例外の指示がない限り、絶対に逸脱しない。

## 1. mainブランチへの直接pushは禁止

- mainブランチはGitHub側で保護されている(Branch protection rule設定済み、`enforce_admins: true`)。リポジトリ管理者であっても直接pushはできない。
- 変更は必ず作業ブランチを作成し、Pull Requestを経由してmainにマージする。
- `git push origin main` のような直接pushを絶対に実行しない。
- PRがマージされると、作業ブランチはGitHub側で自動削除される(`delete_branch_on_merge` 設定済み)。ローカルのブランチは `git branch -d <ブランチ名>` で削除する。

## 2. 作業前に必ずIssueを作成する

- 新機能追加・バグ修正・改善など、ある程度まとまった作業に着手する前に、GitHub Issueを1件作成する。
- Issueには「目的」「背景」「完了条件」を簡潔に書く。
- 機能の実装では、対応する[機能定義書](./機能定義書/)の機能ID(例: `AUTH-01`)をIssueに記載する。
- typo修正やREADMEの誤字修正など、極めて軽微な変更は例外としてIssue作成を省略してよい。

## 3. ブランチ命名規則

`種別/Issue番号-簡単な説明` の形式にする。対応するIssue番号を必ず含めること。

| 種別 | 用途 | 例 |
|---|---|---|
| `feature/` | 新機能追加 | `feature/12-add-login-form` |
| `fix/` | 不具合修正 | `fix/15-fix-like-count` |
| `chore/` | 設定変更・雑務 | `chore/20-update-gitignore` |
| `docs/` | ドキュメント更新 | `docs/22-update-api-doc` |
| `infra/` | Terraform・AWS構成の変更 | `infra/30-add-alb` |

## 4. コミット・PR運用

- PRの説明に対応するIssueを `Closes #12` のように記載し、マージ時にIssueが自動クローズされるようにする。
- PRのタイトルは変更内容が一目でわかるようにする。
- 実装を変更したら、同じPRの中で対応するドキュメント(要件定義書・設計書・機能定義書)も更新する。
- APIを変更したら、同じPRの中でAPI仕様書とフロントの型も生成し直してコミットする(`backend/` で `./gradlew test -PupdateApiDoc`、`frontend/` で `npm run gen:api-types`)。手で書き換えない。詳細は[設計書 4-4](./設計書.md#4-4-api仕様書openapiの自動生成)。

## 5. 開発サーバー起動時のポート管理

- バックエンド(Spring Boot)は**ポート8080固定**、フロントエンド(Vite)は**ポート5173固定**で起動する。
  バックエンドの `CorsConfig.java` が `http://localhost:5173` のみを許可するため、
  フロントを別ポート(5174など)で起動するとAPI通信がすべてCORSエラーになり動作しない。
- ポートが既に使用中でも、**別の空いているポートに逃げて起動してはならない**。
  必ず該当ポートを使用しているプロセスを停止してから、指定されたデフォルトポートで起動し直すこと。
  一時しのぎで別ポートに切り替えるのは禁止。
- 具体的な起動手順・ポート確認/停止コマンドは `.claude/skills/dev-servers/SKILL.md` を参照。
  Claude Codeに「開発サーバーを起動して」と依頼すれば、このルールに従って自動的に対応する。

## 6. 秘密情報の取り扱い

- 以下は絶対にコミットしない(`.gitignore` 設定済み)。
  - `.env` / `.env.*`(DBパスワード・JWT署名キーなど)
  - `backend/src/main/resources/application-local.properties`
  - `infra/terraform.tfvars`・`infra/*.tfstate*`・`infra/.terraform/`
  - `backend/uploads/`(ローカルに保存した画像)
- AWSのアクセスキーはリポジトリ内のどのファイルにも書かない。ECS のタスクから S3 へのアクセスはIAMロール(タスクロール)で行う。
- `terraform apply` / `terraform destroy` など課金・データ削除を伴う操作は、ユーザーの明示的な指示がある場合のみ実行する。

## 7. Claude Codeへの指示

- ユーザーから「〇〇を直してほしい」「〇〇を追加してほしい」等の依頼を受けたら、まずIssueを作成し、その後に対応するブランチを作成してから作業に着手する。
- 作業完了後はPull Requestを作成する。ユーザーから明示的に指示がない限り、Claude Code自身の判断でPRをマージしない(マージはユーザーが行う、または明示的に依頼された場合のみ行う)。
- mainブランチへ直接コミット・pushしようとしない。技術的にも拒否されるが、そもそも試みないこと。
- 「品質チェックして」と依頼されたら `.claude/skills/quality-review/SKILL.md` に従う。
