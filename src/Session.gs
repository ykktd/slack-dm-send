/**
 * Session.gs — Web UI セッション管理。
 * GAS は HTTP-only クッキーを発行できないため、ランダムなセッションIDを
 * 初回URL引数で受け渡し、クライアント側で sessionStorage に退避する。
 * 実体は CacheService に置き、TTLで自動失効させる。
 */

/** セッションを発行し、Slack user_id を紐づける。戻り値はセッションID。 */
function createSession(slackUserId) {
  const sessionId = Utilities.getUuid();
  CacheService.getScriptCache().put(
    `SESSION_${sessionId}`,
    slackUserId,
    SESSION_TTL_SEC
  );
  return sessionId;
}

/**
 * セッションIDから Slack user_id を取得。無効なら null。
 * 送信者の決定は必ずこの関数を通す（クライアントの自己申告は使わない）。
 */
function getUserIdFromSession(sessionId) {
  if (!sessionId) return null;
  return CacheService.getScriptCache().get(`SESSION_${sessionId}`) || null;
}

/** セッションを破棄（ログアウト相当）。 */
function destroySession(sessionId) {
  if (sessionId) CacheService.getScriptCache().remove(`SESSION_${sessionId}`);
}
