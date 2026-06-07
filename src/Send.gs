/**
 * Send.gs — 本人 User token による一斉DM送信。
 * 送信者は必ずセッションから決定し、クライアントの自己申告は使わない。
 */

/** セッションから送信者と本人tokenを解決。失敗時は { error } を返す。 */
function resolveSender(sessionId) {
  const senderUserId = getUserIdFromSession(sessionId);
  if (!senderUserId) return { error: 'セッションが無効です。再連携してください。' };
  const userToken = getUserToken(senderUserId);
  if (!userToken) return { error: 'Slack連携が見つかりません。先に連携してください。' };
  return { senderUserId: senderUserId, userToken: userToken };
}

/**
 * 自分宛てテスト送信（本送信の前に表示を確認するための独立アクション）。
 * 本送信は一切行わない。
 * @return {Object} { ok } または { ok:false, error }
 */
function apiSendTestToSelf(sessionId, message) {
  const s = resolveSender(sessionId);
  if (s.error) return { ok: false, error: s.error };

  const text = String(message || '').trim();
  if (!text) return { ok: false, error: '本文が空です。' };

  const r = sendOneDm(s.userToken, s.senderUserId, text);
  return r.ok ? { ok: true } : { ok: false, error: r.error };
}

/**
 * 一斉DM送信のエントリポイント（クライアントから google.script.run で呼ぶ）。
 * @param {string} sessionId Web UI セッションID
 * @param {string[]} recipientUserIds 送信先 user_id 配列
 * @param {string} message 本文（Slack mrkdwn）
 * @return {Object} { ok, successCount, failures }
 */
function apiSendDm(sessionId, recipientUserIds, message) {
  const s = resolveSender(sessionId);
  if (s.error) return { ok: false, error: s.error };

  const text = String(message || '').trim();
  if (!text) return { ok: false, error: '本文が空です。' };

  const recipients = dedupe(recipientUserIds).filter(Boolean);
  if (recipients.length === 0) return { ok: false, error: '送信先が選択されていません。' };

  const max = getMaxRecipients();
  if (recipients.length > max) {
    return { ok: false, error: `送信先は最大${max}人までです（選択: ${recipients.length}人）。` };
  }

  const interval = getSendIntervalMs();
  let successCount = 0;
  const failures = [];

  recipients.forEach((recipientId, i) => {
    const r = sendOneDm(s.userToken, recipientId, text);
    if (r.ok) successCount++;
    else failures.push({ userId: recipientId, error: r.error });
    if (i < recipients.length - 1 && interval > 0) Utilities.sleep(interval);
  });

  return { ok: true, successCount: successCount, failures: failures };
}

/** 1人に送信。conversations.open → chat.postMessage。429 は1回だけリトライ。 */
function sendOneDm(userToken, recipientUserId, text) {
  try {
    const dm = conversationsOpen(userToken, recipientUserId);
    if (!dm.ok) return { ok: false, error: dm.error };

    let res = chatPostMessage(userToken, dm.channel.id, text);
    if (!res.ok && res.error === 'ratelimited') {
      Utilities.sleep((res._retryAfter || 1) * 1000);
      res = chatPostMessage(userToken, dm.channel.id, text);
    }
    return res.ok ? { ok: true } : { ok: false, error: res.error };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

/** 配列の重複除去。 */
function dedupe(arr) {
  return Array.from(new Set(arr || []));
}
