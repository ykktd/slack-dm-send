/**
 * Code.gs — Web App エントリポイントとルーティング。
 *
 * doGet の分岐:
 *   1) ?code=&state=  → OAuth callback。token保存→セッション発行→送信画面を直接描画。
 *   2) ?session=      → セッション検証。有効ならクライアント側で退避してURLから除去。
 */

/**
 * doPost — Slack からの POST（スラッシュコマンド /dm-send）を処理。
 * Web UIリンクを即時に返すだけで、重い処理は載せない（3秒ACK制限対応）。
 */
function doPost(e) {
  return handleSlashCommand(e);
}

function doGet(e) {
  const p = (e && e.parameter) || {};

  // 1) OAuth callback
  //    GASのiframeサンドボックスは user activation 無しの top 遷移を禁止するため、
  //    自動遷移はせず、利用者がクリックする「ツールを開く」ボタンを表示する。
  //    遷移先の ?session= は初回表示時にクライアント側で退避し、URLから除去する。
  if (p.code && p.state) {
    try {
      const { sessionId } = handleOAuthCallback(p.code, p.state);
      return renderOAuthSuccess(sessionId);
    } catch (err) {
      return renderError(String(err && err.message ? err.message : err));
    }
  }

  // 2) 通常表示
  const session = p.session || '';
  const connected = Boolean(getUserIdFromSession(session));
  return renderApp({
    connected: connected,
    session: connected ? session : '',
    authUrl: buildAuthUrl(),
  });
}

/** メインHTMLを描画（ログイン/送信画面はクライアント側で切替）。 */
function renderApp(state) {
  const t = HtmlService.createTemplateFromFile('Index');
  t.initialState = JSON.stringify(state);
  return t
    .evaluate()
    .setTitle('Slack DM 一斉送信')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT);
}

/**
 * OAuth連携完了ページ。セッション受け渡し用の ?session= URL へ向かう「ツールを開く」ボタンを表示。
 * ボタンのクリック（user activation）でトップ遷移が許可され、遷移先でURLから session を除去する。
 */
function renderOAuthSuccess(sessionId) {
  const url = `${getWebAppUrl()}?session=${encodeURIComponent(sessionId)}`;
  const href = url.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  const html = `<!DOCTYPE html><html lang="ja"><head>
    <base target="_top"><meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
      body{margin:0;background:#f7f8fa;font-family:-apple-system,"Segoe UI","Hiragino Kaku Gothic ProN",Meiryo,sans-serif;color:#1d1c1d}
      .wrap{max-width:520px;margin:48px auto;padding:0 16px}
      .card{background:#fff;border:1px solid #e2e2e3;border-radius:12px;padding:24px;text-align:center}
      h2{font-size:18px;margin:0 0 8px}
      p{color:#616061;margin:0 0 20px}
      .btn{display:inline-block;background:#007a5a;color:#fff;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:8px}
      .btn:hover{background:#006c4f}
    </style></head>
    <body><div class="wrap"><div class="card">
      <h2>Slack連携が完了しました</h2>
      <p>下のボタンからDM送信ツールを開いてください。</p>
      <a class="btn" href="${href}" target="_top">DM送信ツールを開く</a>
    </div></div></body></html>`;
  return HtmlService.createHtmlOutput(html)
    .setTitle('Slack連携完了')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT);
}

/** エラー表示。 */
function renderError(message) {
  const safe = message.replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));
  return HtmlService.createHtmlOutput(
    `<!DOCTYPE html><html><body style="font-family:sans-serif;padding:24px">
     <h3>エラー</h3><p>${safe}</p></body></html>`
  );
}

/** HTMLファイルのインクルード（CSS/JS分割用）。 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * 送信画面の初期化データを返す（クライアントから呼ぶ）。
 * 送信者本人情報とユーザー一覧をまとめて返す。
 */
function apiBootstrap(sessionId) {
  const senderUserId = getUserIdFromSession(sessionId);
  if (!senderUserId) return { ok: false, error: 'セッションが無効です。再連携してください。' };
  if (!getUserToken(senderUserId)) {
    return { ok: false, error: 'Slack連携が見つかりません。先に連携してください。' };
  }

  const users = getUserList();
  const usersById = indexUsersById(users);
  const me = usersById[senderUserId];
  if (!me) {
    return {
      ok: false,
      error: '送信者がこのツールの利用対象ユーザーではありません。通常ユーザー以上のサークルメンバーで連携してください。',
    };
  }

  return {
    ok: true,
    me: me,
    users: users,
    maxRecipients: getMaxRecipients(),
  };
}

/** クライアント側のログアウト。保存済みSlack連携情報も削除し、Web UIセッションを破棄する。 */
function apiLogout(sessionId) {
  const userId = getUserIdFromSession(sessionId);
  try {
    if (userId) deleteUserToken(userId);
  } finally {
    destroySession(sessionId);
  }
  return { ok: true };
}
