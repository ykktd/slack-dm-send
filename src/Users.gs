/**
 * Users.gs — Slack ユーザー一覧の取得・整形・キャッシュ。
 * Bot token で users.list を呼び、表示/検索に必要な最小項目だけを返す。
 * メールアドレスは取得・保持しない。
 */

/** 整形済みユーザー一覧を取得（キャッシュ優先）。 */
function getUserList() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get(USERS_CACHE_KEY);
  if (cached) return JSON.parse(cached);

  const list = fetchAllUsers();
  // CacheService は1値100KB上限。大規模WSでは入らない場合があるため try で保護。
  try {
    cache.put(USERS_CACHE_KEY, JSON.stringify(list), USERS_CACHE_TTL_SEC);
  } catch (e) {
    // キャッシュ不可でもそのまま返す（次回は再取得）。
  }
  return list;
}

/** users.list を全ページ取得し、除外・整形する。 */
function fetchAllUsers() {
  const botToken = requireProp('SLACK_BOT_TOKEN');
  const result = [];
  let cursor = '';

  do {
    const page = usersListPage(botToken, cursor);
    if (!page.ok) {
      throw new Error(`users.list に失敗しました: ${page.error}`);
    }
    (page.members || []).forEach((m) => {
      if (!isExcluded(m)) result.push(toUserView(m));
    });
    cursor = (page.response_metadata && page.response_metadata.next_cursor) || '';
  } while (cursor);

  result.sort((a, b) => a.label.localeCompare(b.label, 'ja'));
  return result;
}

/** 除外対象か判定。deleted / bot / USLACKBOT / ゲストを除外。 */
function isExcluded(member) {
  return (
    Boolean(member.deleted) ||
    Boolean(member.is_bot) ||
    member.id === 'USLACKBOT' ||
    Boolean(member.is_restricted) ||
    Boolean(member.is_ultra_restricted)
  );
}

/** Slack user object を表示用の最小ビューに変換。 */
function toUserView(member) {
  const p = member.profile || {};
  const displayName = p.display_name || '';
  const realName = p.real_name || member.real_name || '';
  const label = displayName || realName || member.name || member.id;
  return {
    id: member.id,
    displayName: displayName,
    realName: realName,
    name: member.name || '',
    image48: p.image_48 || '',
    label: label,
  };
}

/** ユーザー一覧キャッシュを破棄（管理用）。 */
function clearUsersCache() {
  CacheService.getScriptCache().remove(USERS_CACHE_KEY);
}
