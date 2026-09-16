/**
 * WordPress REST API 連携。
 *
 * 今回の課題では実際のWordPressサイトを使わないため、DRY_RUN=true（Config.gs）の間は
 * 実際に送信せず、送信予定のペイロードを Logger.log に出すだけにする。
 * 本番のWordPressが用意できたら、Config.gs の DRY_RUN を false にすれば実送信になる。
 */

/**
 * WordPress REST API（/wp-json/wp/v2/posts）に送るペイロードを組み立てる。
 * @param {string} title
 * @param {string} body 本文（Markdownの見出し記法のまま。実送信時はHTML変換が必要な場合がある）
 * @param {string} metaDescription 検索結果に出る要約文。excerpt（抜粋）として渡す
 * @return {{title: string, content: string, status: string, excerpt: string}}
 */
function buildWordPressPayload(title, body, metaDescription) {
  return {
    title: title,
    content: body,
    status: "draft", // 自動公開はしない。下書き保存のみ（proposal.mdの「やらないこと」）
    excerpt: metaDescription,
  };
}

/**
 * WordPressへ下書きを送る（あるいはDRY_RUNならログに出すだけにする）。
 * @param {{title: string, content: string, status: string, excerpt: string}} payload
 * @return {{dryRun: boolean, postUrl: (string|null)}}
 */
function postToWordPress(payload) {
  if (DRY_RUN) {
    Logger.log(
      "【DRY_RUN】WordPressへの送信ペイロード（実際には送信していません）:",
    );
    Logger.log(JSON.stringify(payload, null, 2));
    return { dryRun: true, postUrl: null };
  }

  // 実送信する場合（DRY_RUN=falseにしたとき）。
  // WORDPRESS_BASE_URL / WORDPRESS_USERNAME / WORDPRESS_APP_PASSWORD をスクリプトプロパティに設定しておくこと。
  const baseUrl = getRequiredProperty("WORDPRESS_BASE_URL");
  const username = getRequiredProperty("WORDPRESS_USERNAME");
  const appPassword = getRequiredProperty("WORDPRESS_APP_PASSWORD");

  const credentials = Utilities.base64Encode(`${username}:${appPassword}`);
  const options = {
    method: "post",
    contentType: "application/json",
    headers: { Authorization: `Basic ${credentials}` },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  };

  const response = UrlFetchApp.fetch(`${baseUrl}/wp-json/wp/v2/posts`, options);
  const statusCode = response.getResponseCode();

  if (statusCode !== 201) {
    throw new Error(
      `WordPressへの投稿に失敗しました（status: ${statusCode}）: ${response.getContentText()}`,
    );
  }

  const created = JSON.parse(response.getContentText());
  return { dryRun: false, postUrl: created.link || null };
}
