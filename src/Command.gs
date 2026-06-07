/**
 * Command.gs — スラッシュコマンド /dm-send。
 *
 * 役割は「Web UIへのリンクを即時に返すだけ」。重い処理は載せず、3秒ACK制限を確実に守る。
 *
 * 【検証方法の注意】
 * GAS の doPost(e) は HTTP リクエストヘッダ（X-Slack-Signature 等）を読めないため、
 * Signing Secret による HMAC 署名検証は実装できない。
 * 代わりに Slash command が body に含める legacy verification token で検証する。
 * （Slack App の Basic Information → App Credentials → Verification Token）
 */

/** スラッシュコマンドを処理し、Web UIリンクを返す。 */
function handleSlashCommand(e) {
  const p = (e && e.parameter) || {};

  const expected = String(getProp('SLACK_VERIFICATION_TOKEN') || '').trim();
  if (!expected || p.token !== expected) {
    return jsonResponse({ response_type: 'ephemeral', text: 'リクエスト検証に失敗しました。' });
  }

  if (p.command !== '/dm-send') {
    return jsonResponse({ response_type: 'ephemeral', text: '不明なコマンドです。' });
  }

  const expectedTeamId = String(getProp('SLACK_TEAM_ID') || '').trim();
  if (expectedTeamId && p.team_id !== expectedTeamId) {
    return jsonResponse({ response_type: 'ephemeral', text: 'リクエスト検証に失敗しました。' });
  }

  const url = getWebAppUrl();
  return jsonResponse({
    response_type: 'ephemeral', // 実行者本人にのみ表示
    text: `*Slack DM 一斉送信ツール*\n下のリンクから開いてください（あなた本人として送信します）。\n<${url}|DM送信ツールを開く>`,
  });
}

/** JSON レスポンスを生成。 */
function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}
