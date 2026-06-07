# Slack個別DM一斉送信ツール — セットアップ手順

GAS（Google Apps Script）単体で動く、本人として複数人に個別DMを一斉送信するツール。
OAuth連携と手動token登録の両方に対応。

## リポジトリ構成
```
.
├── README.md            … 本ファイル（セットアップ手順）
├── .gitignore
├── docs/
│   ├── slack_dm_send_tool_apphome_gas_webui_plan.md … 企画書
│   └── IMPLEMENTATION_PLAN.md                        … 実装計画
└── src/                 … GASソース一式（clasp rootDir）
    ├── appsscript.json  … GASマニフェスト（V8 / Web App公開設定）
    ├── Code.gs          … doGet/doPost ルーティング、画面描画、apiBootstrap
    ├── Config.gs        … 設定値・定数
    ├── Slack.gs         … Slack Web API ラッパ
    ├── OAuth.gs         … OAuth と User token 保存
    ├── Session.gs       … Web UI セッション
    ├── Users.gs         … ユーザー一覧取得・キャッシュ
    ├── Send.gs          … 一斉DM送信（apiSendDm）
    ├── Command.gs       … スラッシュコマンド /dm-send
    └── Index.html / Stylesheet.html / JavaScript.html … Web UI
```

> clasp で `rootDir: src` を使う前提の配置。手動でGASエディタに貼る場合は、`src/` 内のファイルを**ファイル名のみ**（`Code`, `Index` など）で作成する。`.clasp.json` は scriptId を含むため `.gitignore` 済み（コミットしない）。

---

## clasp / gh での自動化（推奨ワークフロー）

> 前提: <https://script.google.com/home/usersettings> で「Google Apps Script API」をオンにしておく。

```bash
# 0) ログイン（未ログインなら）
clasp login          # Google
gh auth login        # GitHub

# 1) GASプロジェクト作成 → push → 初回デプロイ（リポジトリのルートで）
clasp create --type standalone --title "Slack DM Send" --rootDir src
clasp push -f
clasp deploy --description "v1"
clasp deployments    # 表示された AKfyc... が deploymentId
#   → Web App URL = https://script.google.com/macros/s/<deploymentId>/exec

# 2) Script Properties を設定（GASエディタUIが確実）
clasp open-script    # プロジェクトの設定 → スクリプト プロパティ で登録

# 3) コードを更新したときは「同じデプロイ」を上書き（URLを変えないため）
clasp push -f
clasp deploy -i <deploymentId> --description "update"

# 4) GitHubへ公開
git init && git add . && git commit -m "Initial commit"
gh repo create slack-dm-send --public --source=. --remote=origin --push
```

> **重要**: URLを固定したいので、2回目以降は必ず `clasp deploy -i <deploymentId>` で同じデプロイを更新する（`-i` 無しだと新URLが発行され、Slack側の登録URLと食い違う）。

---

## 1. GASプロジェクト作成
1. <https://script.google.com> で新規プロジェクトを作成。
2. `src/` 内の `.gs` / `.html` ファイルを同名で作成し、内容を貼り付ける。
   - `appsscript.json` は「プロジェクトの設定 → 『appsscript.json マニフェスト ファイルをエディタで表示』」を有効化して上書き。
   - HTMLファイルは拡張子なしの名前（`Index`, `Stylesheet`, `JavaScript`）で作成。

## 2. Slack App作成
1. <https://api.slack.com/apps> →「Create New App」→「From scratch」。
2. **OAuth & Permissions** で Scope を設定：
   - Bot Token Scopes: `users:read`（任意で `chat:write`）
   - User Token Scopes: `chat:write`, `im:write`（任意で `users:read`）
3. **Basic Information** から `Client ID` / `Client Secret` / `Verification Token` を控える。
   - `Verification Token` はスラッシュコマンド検証に使う（手順7）。
4. ワークスペースにインストールし、`Bot User OAuth Token`（`xoxb-…`）を控える。

## 3. Web Appとしてデプロイ（先にURLを確定）
1. GASエディタ →「デプロイ →新しいデプロイ →種類: ウェブアプリ」。
2. 「次のユーザーとして実行: 自分」「アクセスできるユーザー: 全員」。
3. デプロイ後の **ウェブアプリURL（`…/exec`）** を控える。

## 4. Slackに redirect URL を登録
1. Slack App →「OAuth & Permissions」→「Redirect URLs」に、手順3の `…/exec` URLを**そのまま**追加して保存。
   - ここが一致しないとOAuthが失敗する最大の原因。末尾まで完全一致させる。

## 5. Script Properties を設定
GASエディタ →「プロジェクトの設定 →スクリプト プロパティ」で以下を登録：

| キー | 値 |
|---|---|
| `SLACK_CLIENT_ID` | Slack App の Client ID |
| `SLACK_CLIENT_SECRET` | Client Secret |
| `SLACK_BOT_TOKEN` | `xoxb-…`（手順2-4） |
| `WEB_APP_URL` | 手順3の `…/exec` URL |
| `MAX_RECIPIENTS` | `10`（任意） |
| `SEND_INTERVAL_MS` | `1000`（任意） |
| `SLACK_VERIFICATION_TOKEN` | `/dm-send` を使う場合のみ。手順2-3の Verification Token |

> 未設定なら `/dm-send` の検証はスキップされる（動作はする）。本番では設定を推奨。

## 6. 利用方法（2通り）

### A. OAuth連携（推奨・セルフサービス）
1. ウェブアプリURL（`…/exec`）を開く。
2. 「Slackと連携する」→ Slackで許可 → 自動で送信画面へ。
3. 送信先を選択 → 本文入力 → 確認 → 送信。

### B. 手動token登録（管理者がすぐ試す用）
1. 自分の **User OAuth Token**（`xoxp-…`）を取得（Slack App の「Install App」画面、または OAuth で発行）。
2. Script Properties に `USER_TOKEN_<あなたのSlack user_id>` = `xoxp-…` を登録。
   - user_id は Slack プロフィール →「メンバーIDをコピー」（`U…`）。
3. GASエディタで一時的に次を実行してセッションURLを得る：
   ```js
   function makeMyLink() {
     var uid = 'Uxxxxxxxx'; // 自分のSlack user_id
     var sid = createSession(uid);
     Logger.log(getWebAppUrl() + '?session=' + sid);
   }
   ```
4. ログのURLを開くと送信画面に入れる。

## 7. （任意）スラッシュコマンド /dm-send
Slack内から `/dm-send` でWeb UIリンクを呼び出せるようにする。リンクを返すだけで送信処理は行わない。

1. Slack App →「Slash Commands」→「Create New Command」。
   - Command: `/dm-send`
   - Request URL: 手順3の `…/exec` URL
   - Short Description: 例「DM一斉送信ツールを開く」
2. Script Properties に `SLACK_VERIFICATION_TOKEN`（手順2-3）を登録。
3. コード変更があるため再デプロイ（「デプロイを管理 → 編集 → バージョン: 新バージョン」）。
4. Slackで `/dm-send` を実行 → 本人にだけ表示されるリンクからツールを開く。

> **検証方式の注意**: GASの `doPost(e)` はHTTPヘッダ（`X-Slack-Signature`）を読めないため、Signing SecretによるHMAC署名検証は使えない。本実装はSlashコマンドがbodyに含めるlegacy verification tokenで検証する。

---

## 動作の要点（安全設計）
- 送信者は必ずセッション上の `user_id` から決定。ブラウザから送信者IDは受け取らない。
- `?session=...` は初回表示時に `sessionStorage` へ退避し、ブラウザURLから除去する。
- 使用するtokenは `USER_TOKEN_<セッション上のuser_id>` のみ。
- OAuth `state` は CacheService で発行・照合し、callbackで1回限り消費。
- 送信ログ・本文履歴・メールアドレスは保存しない。
- 1件ごとに `SEND_INTERVAL_MS` 待機、`ratelimited` は `Retry-After` を尊重して1回リトライ。
- `/dm-send` はWeb UIリンクを即時返すのみで、送信処理は載せない（3秒ACK制限対応）。
- 除外: `deleted` / `is_bot` / `USLACKBOT` / ゲスト（`is_restricted` / `is_ultra_restricted`）。

## トラブルシュート
- **OAuthで `bad_redirect_uri`**: 手順4のRedirect URLと `WEB_APP_URL` が `…/exec` で完全一致しているか確認。
- **`invalid_scope`**: User Token Scopes に `chat:write` と `im:write` があるか確認。
- **ユーザー一覧が出ない**: `SLACK_BOT_TOKEN` 未設定、または Bot に `users:read` が無い。
- **コード変更が反映されない**: 「デプロイを管理 →編集 →バージョン: 新バージョン」で再デプロイ。
