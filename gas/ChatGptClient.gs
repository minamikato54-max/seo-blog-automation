/**
 * ChatGPT API（Chat Completions）を呼び出す処理。
 */

const OPENAI_ENDPOINT = "https://api.openai.com/v1/chat/completions";
const MAX_RETRIES = 2;

/**
 * プロンプトを渡してChatGPTを呼び、{title, body, metaDescription} を返す。
 * @param {string} prompt buildPrompt() で作った文字列
 * @return {{title: string, body: string, metaDescription: string}}
 */
function callChatGpt(prompt) {
  const apiKey = getRequiredProperty("OPENAI_API_KEY");

  const payload = {
    model: OPENAI_MODEL,
    messages: [{ role: "user", content: prompt }],
    // モデルがJSONモードに対応していれば、出力形式をより確実にする
    response_format: { type: "json_object" },
    temperature: 0.7,
  };

  const options = {
    method: "post",
    contentType: "application/json",
    headers: { Authorization: `Bearer ${apiKey}` },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  };

  let lastError = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const response = UrlFetchApp.fetch(OPENAI_ENDPOINT, options);
    const statusCode = response.getResponseCode();
    const rawBody = response.getContentText();

    if (statusCode === 200) {
      return parseChatGptResponse(rawBody);
    }

    lastError = new Error(
      `ChatGPT API呼び出しに失敗しました（status: ${statusCode}）: ${rawBody}`,
    );

    // 429（レート制限）や5xx（サーバー側の一時エラー）はリトライ、それ以外は即エラーにする
    const retriable = statusCode === 429 || statusCode >= 500;
    if (!retriable || attempt === MAX_RETRIES) {
      throw lastError;
    }
    Utilities.sleep(1000 * (attempt + 1));
  }

  throw lastError;
}

/**
 * ChatGPT APIのレスポンス本体（JSON文字列）から、記事本体のJSONを取り出してパースする。
 * @param {string} rawBody UrlFetchApp.fetch().getContentText()
 * @return {{title: string, body: string, metaDescription: string}}
 */
function parseChatGptResponse(rawBody) {
  const responseJson = JSON.parse(rawBody);
  const content =
    responseJson.choices &&
    responseJson.choices[0] &&
    responseJson.choices[0].message
      ? responseJson.choices[0].message.content
      : null;

  if (!content) {
    throw new Error(
      `ChatGPTのレスポンスから本文を取り出せませんでした: ${rawBody}`,
    );
  }

  let article;
  try {
    article = JSON.parse(content);
  } catch (e) {
    throw new Error(`ChatGPTの出力がJSON形式ではありませんでした: ${content}`);
  }

  if (!article.title || !article.body || !article.metaDescription) {
    throw new Error(
      `ChatGPTの出力に title / body / metaDescription のいずれかが欠けています: ${content}`,
    );
  }

  return {
    title: article.title,
    body: article.body,
    metaDescription: article.metaDescription,
  };
}
