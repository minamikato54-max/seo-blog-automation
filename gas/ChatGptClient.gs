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
    // title/body/metaDescriptionの3つを必ず含む形でしか返せないよう、JSON Schemaで強制する
    // （2026-09-16: 単なるjson_objectモードだと、metaDescriptionを省略した回答が返ることがあったため）
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "seo_article",
        strict: true,
        schema: {
          type: "object",
          properties: {
            title: { type: "string" },
            body: { type: "string" },
            metaDescription: { type: "string" },
          },
          required: ["title", "body", "metaDescription"],
          additionalProperties: false,
        },
      },
    },
    // 2026-09-16: gpt-5.5 は temperature にデフォルト値(1)以外を指定できない
    // （エラー: "Unsupported value: 'temperature' does not support 0.7 with this model."）ため、
    // temperatureは指定せずAPI側のデフォルトに任せる。gpt-4o系に戻す場合は temperature: 0.7 を戻すとよい。
    // 日本語の本文（2,000〜3,000字）+タイトル+メタディスクリプションがJSONで
    // 途中で切れないよう、余裕を持った上限にしておく（レスポンスが長くなりすぎる心配はない）。
    // 2026-09-16: gpt-5.5 では `max_tokens` が使えず `max_completion_tokens` に名称変更されていた
    // （エラー: "Unsupported parameter: 'max_tokens' is not supported with this model."）。
    // gpt-4o系では逆に max_tokens が必要なため、モデルを戻す場合はここも戻すこと。
    max_completion_tokens: 4000,
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
