/**
 * OAuth.gs — Slack OAuth (v2) と本人 User token の保存。
 * state は CacheService に発行・保存し、callback で照合・消費する。
 */

/** 認可開始URLを生成（state発行込み）。非配信アプリ向けに team を付与。 */
function buildAuthUrl() {
  const state = Utilities.getUuid();
  CacheService.getScriptCache().put(
    `OAUTH_STATE_${state}`,
    String(Date.now()),
    STATE_TTL_SEC
  );
  const params = {
    client_id: requireProp('SLACK_CLIENT_ID'),
    scope: BOT_SCOPES.join(','),
    user_scope: USER_SCOPES.join(','),
    redirect_uri: getWebAppUrl(),
    state: state,
  };
  const teamId = getTeamId();
  if (teamId) params.team = teamId;
  const query = Object.keys(params)
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`)
    .join('&');
  return `${SLACK_AUTHORIZE_URL}?${query}`;
}

/** ワークスペース(team) IDを取得。未設定ならBotトークンのauth.testから取得しキャッシュ。 */
function getTeamId() {
  const cached = getProp('SLACK_TEAM_ID');
  if (cached) return cached;
  const r = slackApi('auth.test', requireProp('SLACK_BOT_TOKEN'), {}, 'form');
  if (r.ok && r.team_id) {
    setProp('SLACK_TEAM_ID', r.team_id);
    return r.team_id;
  }
  return '';
}

/** state を検証し、有効なら消費（1回限り）。 */
function consumeState(state) {
  if (!state) return false;
  const cache = CacheService.getScriptCache();
  const key = `OAUTH_STATE_${state}`;
  const hit = cache.get(key);
  if (!hit) return false;
  cache.remove(key);
  return true;
}

/**
 * OAuth callback を処理。成功時は本人 User token を保存し、
 * セッションを発行して { sessionId, userId } を返す。失敗時は例外。
 */
function handleOAuthCallback(code, state) {
  if (!consumeState(state)) {
    throw new Error('OAuth state が無効か期限切れです。最初からやり直してください。');
  }

  const data = oauthAccess(code);
  if (!data.ok) {
    throw new Error(`OAuth に失敗しました: ${data.error}`);
  }

  const authedUser = data.authed_user || {};
  const userId = authedUser.id;
  const userToken = authedUser.access_token;
  if (!userId || !userToken) {
    throw new Error('User token を取得できませんでした。user_scope の設定を確認してください。');
  }

  saveUserToken(userId, userToken);

  // Bot token が未保存なら、この認可で得たものを保存（初回インストール時）。
  if (data.access_token && !getProp('SLACK_BOT_TOKEN')) {
    setProp('SLACK_BOT_TOKEN', data.access_token);
  }

  return { sessionId: createSession(userId), userId: userId };
}

/** 本人 User token を保存（同時書き込み防止のためロック）。 */
function saveUserToken(userId, userToken) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    setProp(`USER_TOKEN_${userId}`, userToken);
  } finally {
    lock.releaseLock();
  }
}

/** 本人 User token を取得。無ければ null。 */
function getUserToken(userId) {
  return getProp(`USER_TOKEN_${userId}`);
}

/** 本人 User token を削除（連携解除）。 */
function deleteUserToken(userId) {
  deleteProp(`USER_TOKEN_${userId}`);
}
