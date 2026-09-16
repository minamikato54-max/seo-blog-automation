/**
 * 設定値まとめ。
 * シート名・列番号・DRY_RUNフラグなど、他ファイルから参照する定数はここに集約する。
 */

// 対象シート名（新しいスプレッドシートで、キーワード一覧を置いているシート名に合わせる）
const SHEET_NAME = "キーワード";

// 列番号（1始まり）。ヘッダー行（1行目）はこの並びで用意する:
// キーワード | サブキーワード | ステータス | タイトル | 本文 | メタディスクリプション | WordPress URL
const COL = {
  KEYWORD: 1,
  SUB_KEYWORDS: 2,
  STATUS: 3,
  TITLE: 4,
  BODY: 5,
  META_DESCRIPTION: 6,
  WORDPRESS_URL: 7,
};

const HEADER_ROW = 1;
const FIRST_DATA_ROW = 2;

// ステータスの表記（ハードコードではなく1箇所にまとめる）
const STATUS = {
  NOT_GENERATED: "未生成",
  DONE: "完成",
  ERROR: "エラー",
  // 「投稿済み」への変更は人が手動で行う（このコードでは書き込まない）
};

// true の間は WordPress へ実際に送信せず、送信予定のペイロードを Logger.log に出すだけにする。
// 本番のWordPressが用意できたら false にすると実送信になる（今回の課題スコープでは true のまま）。
const DRY_RUN = true;

// 記事の要件（proposal.md の「2. ご提案内容」に合わせる）
const ARTICLE_MIN_LENGTH = 2000;
const ARTICLE_MAX_LENGTH = 3000;

// 使うモデル。JSON形式での出力指定に対応したモデルを想定。
const OPENAI_MODEL = "gpt-4o-mini";

/**
 * スクリプトプロパティから値を取得する共通処理。
 * 「プロジェクトの設定」→「スクリプト プロパティ」で登録しておく。
 *   OPENAI_API_KEY        : ChatGPT APIキー（必須）
 *   WORDPRESS_BASE_URL     : 例 https://example-saas.co.jp（DRY_RUN=falseのときのみ必須）
 *   WORDPRESS_USERNAME     : WordPressのユーザー名（同上）
 *   WORDPRESS_APP_PASSWORD : WordPressのアプリケーションパスワード（同上）
 */
function getRequiredProperty(key) {
  const value = PropertiesService.getScriptProperties().getProperty(key);
  if (!value) {
    throw new Error(
      `スクリプトプロパティ「${key}」が設定されていません。プロジェクトの設定から登録してください。`,
    );
  }
  return value;
}
