# Slack DM 一斉送信ツール — 管理者向け導入ガイド

Slackワークスペースのメンバーが、**自分本人として**複数人へ個別DMを送るためのGoogle Apps Script（GAS）製ツールです。

このREADMEは、Slackワークスペース管理者またはアプリ管理者が、ツールをワークスペースへ導入・運用するための手順です。

## このツールでできること

- 利用者本人のSlackアカウントとして、複数人に個別DMを送信します。
- Botとして一斉投稿するのではなく、各送信者がSlack OAuthで本人連携して使います。
- 送信先一覧はSlackのユーザー一覧から選択します。
- 送信前にプレビューと確認画面を表示します。
- 自分宛てテスト送信ができます。
- 送信ログ、本文履歴、メールアドレスは保存しません。

## 導入前に確認すること

| 項目 | 内容 |
|---|---|
| Googleアカウント | GASプロジェクトを作成・管理できるアカウントが必要です。 |
| Slack権限 | Slack Appを作成し、対象ワークスペースへインストールできる権限が必要です。 |
| コード編集 | 通常の運用では不要です。初回導入時だけ、`src/` 内のファイル内容をGASエディタへ貼り付けます。 |
| コマンド操作 | 不要です。`clasp` / `gh` は開発者向けの補足手順だけで使います。 |

## 導入の全体像

1. Slack Appを作成し、必要な権限を設定する
2. GASプロジェクトを作成し、`src/` 内のファイルを貼り付ける
3. GASをWebアプリとしてデプロイし、URLを取得する
4. Slack AppにRedirect URLを登録する
5. Slack Appをワークスペースへインストールする
6. GASのScript PropertiesにSlack App情報を登録する
7. 管理者が動作確認し、利用者へWebアプリURLを案内する

---

## 1. Slack Appを作成する

1. <https://api.slack.com/apps> を開きます。
2. 「Create New App」→「From scratch」を選びます。
3. App Nameを入力します。例: `Slack DM Send`
4. 導入先のワークスペースを選びます。

## 2. Slack Appの権限を設定する

Slack Appの管理画面で「OAuth & Permissions」を開き、以下のScopeを追加します。

| 種類 | Scope | 用途 |
|---|---|---|
| Bot Token Scopes | `users:read` | 送信先候補のユーザー一覧を取得するため |
| User Token Scopes | `chat:write` | 利用者本人としてDM本文を送信するため |
| User Token Scopes | `im:write` | 利用者本人としてDMチャンネルを開くため |

設定後、まだ「Install to Workspace」は押さずに次へ進みます。

## 3. GASプロジェクトを作成する

1. <https://script.google.com> を開きます。
2. 「新しいプロジェクト」を作成します。
3. プロジェクト名を変更します。例: `Slack DM Send`
4. 左側のファイル一覧で、`src/` 内のファイルをGASプロジェクトへ作成して貼り付けます。

作成するファイルは以下です。

| リポジトリ上のファイル | GASエディタで作るファイル |
|---|---|
| `src/Code.gs` | スクリプトファイル `Code` |
| `src/Config.gs` | スクリプトファイル `Config` |
| `src/Slack.gs` | スクリプトファイル `Slack` |
| `src/OAuth.gs` | スクリプトファイル `OAuth` |
| `src/Session.gs` | スクリプトファイル `Session` |
| `src/Users.gs` | スクリプトファイル `Users` |
| `src/Send.gs` | スクリプトファイル `Send` |
| `src/Command.gs` | スクリプトファイル `Command` |
| `src/Index.html` | HTMLファイル `Index` |
| `src/Stylesheet.html` | HTMLファイル `Stylesheet` |
| `src/JavaScript.html` | HTMLファイル `JavaScript` |

### appsscript.jsonを設定する

1. GASエディタ左側の「プロジェクトの設定」を開きます。
2. 「appsscript.json マニフェスト ファイルをエディタで表示」をオンにします。
3. 左側のファイル一覧に表示された `appsscript.json` を開きます。
4. 内容を `src/appsscript.json` の内容で上書きします。
5. 保存します。

## 4. GASをWebアプリとしてデプロイする

1. GASエディタ右上の「デプロイ」→「新しいデプロイ」を選びます。
2. 種類の歯車アイコンから「ウェブアプリ」を選びます。
3. 次のように設定します。

| 項目 | 設定値 |
|---|---|
| 説明 | `v1` など任意 |
| 次のユーザーとして実行 | 自分 |
| アクセスできるユーザー | 全員 |

4. 「デプロイ」を押します。
5. 表示された **ウェブアプリURL** を控えます。URLは `https://script.google.com/macros/s/.../exec` の形です。

このURLは以後、Slack App側のRedirect URLやSlash Command URLとして使います。変更しないように控えておいてください。

利用者がGoogleアカウントでログインしなくても開ける必要があるため、「アクセスできるユーザー」は組織内限定ではなく、外部からアクセスできる設定を選んでください。

## 5. Slack AppにRedirect URLを登録する

1. Slack App管理画面に戻ります。
2. 「OAuth & Permissions」を開きます。
3. 「Redirect URLs」に、手順4で控えたGASのウェブアプリURLを追加します。
4. 「Save URLs」を押します。

Redirect URLは、GASのウェブアプリURLと完全一致している必要があります。末尾の `/exec` まで含めて登録してください。

## 6. Slack Appをワークスペースへインストールする

1. Slack App管理画面の「Install App」を開きます。
2. 「Install to Workspace」を押します。
3. 権限確認画面で許可します。
4. 表示された **Bot User OAuth Token** を控えます。`xoxb-...` で始まる値です。

## 7. GASのScript Propertiesを設定する

GASエディタで「プロジェクトの設定」→「スクリプト プロパティ」を開き、以下を登録します。

| キー | 値 | 必須 |
|---|---|---|
| `SLACK_CLIENT_ID` | Slack AppのClient ID | 必須 |
| `SLACK_CLIENT_SECRET` | Slack AppのClient Secret | 必須 |
| `SLACK_BOT_TOKEN` | 手順6で控えた `xoxb-...` | 必須 |
| `WEB_APP_URL` | 手順4で控えたGASのウェブアプリURL | 必須 |
| `MAX_RECIPIENTS` | 1回に送れる最大人数。例: `30` | 任意 |
| `SEND_INTERVAL_MS` | 1件ごとの送信間隔。例: `1200` | 任意 |
| `SLACK_VERIFICATION_TOKEN` | `/dm-send` を使う場合のみ設定 | 任意 |

Client ID / Client Secretは、Slack App管理画面の「Basic Information」→「App Credentials」から確認できます。

## 8. 管理者が動作確認する

1. GASのウェブアプリURLを開きます。
2. Googleの承認画面が表示された場合は、GASプロジェクトの管理者アカウントで承認します。
3. 画面に「Slackと連携する」ボタンが表示されることを確認します。
4. 「Slackと連携する」を押し、自分のSlackアカウントで許可します。
5. 送信画面が開き、ユーザー一覧が表示されることを確認します。
6. 自分宛てテスト送信を行い、Slack DMに届くことを確認します。

確認できたら、利用者へGASのウェブアプリURLを案内してください。

## 利用者への案内文例

以下のような案内をSlackチャンネルなどに投稿できます。

```text
Slack DM一斉送信ツールを導入しました。
以下のURLを開き、「Slackと連携する」から本人連携して利用してください。

<GASのウェブアプリURL>

このツールはBotではなく、利用者本人として個別DMを送信します。
送信前に確認画面が表示され、自分宛てテスト送信もできます。
```

---

## 任意: Slackで `/dm-send` から開けるようにする

Slash Commandを設定すると、Slack上で `/dm-send` と入力してツールのリンクを表示できます。送信処理は行わず、本人にだけWeb UIリンクを返します。

1. Slack App管理画面で「Slash Commands」を開きます。
2. 「Create New Command」を押します。
3. 以下を設定します。

| 項目 | 値 |
|---|---|
| Command | `/dm-send` |
| Request URL | GASのウェブアプリURL |
| Short Description | `DM一斉送信ツールを開く` など |

4. Slack App管理画面の「Basic Information」→「App Credentials」からVerification Tokenを確認します。
5. GASのScript Propertiesに `SLACK_VERIFICATION_TOKEN` として登録します。

この実装では、GASの制約によりSlackの `X-Slack-Signature` ヘッダを読めません。そのため、Slash Commandの検証にはlegacy verification tokenを使います。

## コードを更新した場合

GASエディタ上でファイルを修正した場合は、変更を保存しただけでは公開中のWebアプリに反映されないことがあります。

1. GASエディタ右上の「デプロイ」→「デプロイを管理」を開きます。
2. 現在のデプロイを選び、鉛筆アイコンで編集します。
3. 「バージョン」で「新バージョン」を選びます。
4. 「デプロイ」を押します。

既存のデプロイを更新すれば、GASのウェブアプリURLは変わりません。

## 運用上の注意

- GASプロジェクトの編集権限は、運用に必要な管理者だけに絞ってください。
- Script PropertiesにはSlack AppのClient Secret、Bot Token、利用者本人のSlack連携情報が保存されます。閲覧・編集できる人を最小限にしてください。
- 利用者がログアウトすると、その利用者のSlack連携情報は削除されます。次回利用時は再度「Slackと連携する」から始めます。
- ゲスト、Bot、削除済みユーザー、Slackbotは送信先候補から除外されます。
- `MAX_RECIPIENTS` を大きくしすぎると、Slack APIのrate limitに当たりやすくなります。最初は `30` 程度を推奨します。

## トラブルシュート

| 症状 | 確認すること |
|---|---|
| OAuthで `bad_redirect_uri` が出る | Slack AppのRedirect URL、GASの `WEB_APP_URL`、実際に開いているURLがすべて同じ `.../exec` になっているか確認してください。 |
| Slack連携後にエラーになる | `SLACK_CLIENT_ID` / `SLACK_CLIENT_SECRET` / `WEB_APP_URL` が正しいか確認してください。 |
| ユーザー一覧が出ない | `SLACK_BOT_TOKEN` が設定されているか、Bot Token Scopesに `users:read` があるか確認してください。 |
| 送信できない | User Token Scopesに `chat:write` と `im:write` があるか確認してください。Scopeを後から追加した場合はSlack Appを再インストールしてください。 |
| `/dm-send` が検証エラーになる | `SLACK_VERIFICATION_TOKEN` がSlack App側のVerification Tokenと一致しているか確認してください。 |
| コード変更が反映されない | GASで「デプロイを管理」から既存デプロイを新バージョンに更新してください。 |

---

## 開発者向け: clasp / gh を使う場合

通常のワークスペース導入では、この章は不要です。ソース管理や自動デプロイを行う開発者向けの補足です。

前提: <https://script.google.com/home/usersettings> で「Google Apps Script API」をオンにしておきます。

```bash
clasp login
clasp create --type standalone --title "Slack DM Send" --rootDir src
clasp push -f
clasp deploy --description "v1"
clasp deployments
```

表示された `AKfyc...` がdeployment IDです。

2回目以降にURLを変えず更新する場合は、同じdeployment IDを指定します。

```bash
clasp push -f
clasp deploy -i <deploymentId> --description "update"
```

GitHubリポジトリ作成に `gh` を使う場合は、通常のGitHub CLI手順に従ってください。ワークスペース管理者がこのツールを導入するだけなら `gh` は不要です。

## リポジトリ構成

```text
.
├── README.md
└── src/
    ├── appsscript.json
    ├── Code.gs
    ├── Config.gs
    ├── Slack.gs
    ├── OAuth.gs
    ├── Session.gs
    ├── Users.gs
    ├── Send.gs
    ├── Command.gs
    ├── Index.html
    ├── Stylesheet.html
    └── JavaScript.html
```
