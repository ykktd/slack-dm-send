/**
 * Config.gs — 設定値の取得と定数。
 * 秘密情報はソースに書かず、すべて Script Properties から読む。
 */

const SLACK_API_BASE = 'https://slack.com/api';
const SLACK_AUTHORIZE_URL = 'https://slack.com/oauth/v2/authorize';

// OAuth で要求する Scope。
const BOT_SCOPES = ['users:read'];
const USER_SCOPES = ['chat:write', 'im:write'];

// CacheService の TTL（秒）。
const SESSION_TTL_SEC = 6 * 60 * 60; // 6時間
const STATE_TTL_SEC = 10 * 60; // 10分
const USERS_CACHE_TTL_SEC = 30 * 60; // 30分
const USERS_CACHE_KEY = 'SLACK_USERS_CACHE';

// 送信のデフォルト値（Script Properties で上書き可能）。
const DEFAULT_MAX_RECIPIENTS = 10;
const DEFAULT_SEND_INTERVAL_MS = 1000;

/** Script Properties から1件取得。未設定なら null。 */
function getProp(key) {
  return PropertiesService.getScriptProperties().getProperty(key);
}

/** Script Properties に1件保存。 */
function setProp(key, value) {
  PropertiesService.getScriptProperties().setProperty(key, value);
}

/** Script Properties から1件削除。 */
function deleteProp(key) {
  PropertiesService.getScriptProperties().deleteProperty(key);
}

/** 必須設定を取得。無ければ例外。 */
function requireProp(key) {
  const v = getProp(key);
  if (!v) throw new Error(`設定が不足しています: ${key}`);
  return v;
}

/** 一度に送れる最大人数。 */
function getMaxRecipients() {
  const v = Number(getProp('MAX_RECIPIENTS'));
  return Number.isFinite(v) && v > 0 ? v : DEFAULT_MAX_RECIPIENTS;
}

/** 送信間隔（ミリ秒）。 */
function getSendIntervalMs() {
  const v = Number(getProp('SEND_INTERVAL_MS'));
  return Number.isFinite(v) && v >= 0 ? v : DEFAULT_SEND_INTERVAL_MS;
}

/** このWeb AppのデプロイURL（/exec）。OAuth redirect_uri に使う。 */
function getWebAppUrl() {
  return getProp('WEB_APP_URL') || ScriptApp.getService().getUrl();
}
