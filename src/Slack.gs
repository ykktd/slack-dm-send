/**
 * Slack.gs — Slack Web API の薄いラッパ。
 * すべて UrlFetchApp で叩き、ok=false は呼び出し側で扱えるよう error をそのまま返す。
 */

/**
 * Slack API を呼ぶ共通関数。
 * @param {string} method 例 'users.list'
 * @param {string} token Bot or User token
 * @param {Object} payload リクエストボディ（JSON）
 * @param {string} contentType 'json'(既定) | 'form'
 * @return {Object} パース済みレスポンス（{ok, ...} or {ok:false, error, _httpStatus}）
 */
function slackApi(method, token, payload, contentType) {
  const isForm = contentType === 'form';
  const options = {
    method: 'post',
    muteHttpExceptions: true,
    headers: { Authorization: `Bearer ${token}` },
    contentType: isForm
      ? 'application/x-www-form-urlencoded'
      : 'application/json; charset=utf-8',
    payload: isForm ? payload : JSON.stringify(payload || {}),
  };

  const res = UrlFetchApp.fetch(`${SLACK_API_BASE}/${method}`, options);
  const status = res.getResponseCode();
  let body;
  try {
    body = JSON.parse(res.getContentText());
  } catch (e) {
    return { ok: false, error: `invalid_json_response_${status}` };
  }
  body._httpStatus = status;
  body._retryAfter = Number(res.getHeaders()['Retry-After'] || 0);
  return body;
}

/** OAuth code を token に交換（oauth.v2.access）。token不要・form形式。 */
function oauthAccess(code) {
  const payload = {
    client_id: requireProp('SLACK_CLIENT_ID'),
    client_secret: requireProp('SLACK_CLIENT_SECRET'),
    code: code,
    redirect_uri: getWebAppUrl(),
  };
  // この呼び出しだけは Authorization ヘッダ無し（form body 認証）。
  const res = UrlFetchApp.fetch(`${SLACK_API_BASE}/oauth.v2.access`, {
    method: 'post',
    muteHttpExceptions: true,
    contentType: 'application/x-www-form-urlencoded',
    payload: payload,
  });
  return JSON.parse(res.getContentText());
}

/** ユーザー一覧を1ページ取得。 */
function usersListPage(botToken, cursor) {
  const payload = { limit: 200 };
  if (cursor) payload.cursor = cursor;
  return slackApi('users.list', botToken, payload, 'form');
}

/** 本人としてDMチャンネルを開く。 */
function conversationsOpen(userToken, recipientUserId) {
  return slackApi('conversations.open', userToken, { users: recipientUserId });
}

/** 本人としてメッセージ送信（mrkdwn有効）。 */
function chatPostMessage(userToken, channelId, text) {
  return slackApi('chat.postMessage', userToken, {
    channel: channelId,
    text: normalizeMrkdwn(text),
    mrkdwn: true,
    unfurl_links: false,
    unfurl_media: false,
  });
}

/**
 * Slackのmrkdwn境界問題を補正する。
 * Slackは *太字* の開始/終了 `*` が単語文字（日本語含む）と隣接していると
 * 太字化しない。太字スパンの外側にゼロ幅スペース(U+200B)を挿入して境界を作る。
 * ゼロ幅スペースは不可視なので見た目は変わらない。
 */
function normalizeMrkdwn(text) {
  const ZWSP = '​';
  return String(text).replace(/\*([^*\n]+)\*/g, `${ZWSP}*$1*${ZWSP}`);
}
