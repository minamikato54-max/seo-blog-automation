/**
 * メインの処理フロー。カスタムメニュー「記事を生成」から呼ばれる。
 *
 * 課題文の指定どおり、「選択行のキーワードを取得して記事生成する」方式。
 * 実行する前に、対象のキーワード行（1行、または複数行のまとめ選択）をクリックして選んでおく。
 * 選んだ行それぞれについて:
 *   1. プロンプトを組み立てて ChatGPT で記事下書きを生成
 *   2. タイトル・本文・メタディスクリプションをシートに書き込み、ステータスを「完成」に更新
 *   3. WordPressへの送信ペイロードを組み立て、DRY_RUNならログに出す（今回は実送信しない）
 *
 * 「投稿済み」への更新は行わない（人がWordPressで公開した後、手動でステータスを変える運用）。
 */
function generateArticles() {
  const sheet =
    SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  if (!sheet) {
    throw new Error(
      `シート「${SHEET_NAME}」が見つかりません。Config.gsのSHEET_NAMEを確認してください。`,
    );
  }

  const targetRows = getSelectedDataRows(sheet);
  if (targetRows.length === 0) {
    SpreadsheetApp.getUi().alert(
      "記事を作りたいキーワードの行を選択してから、もう一度実行してください。",
    );
    return;
  }

  let successCount = 0;
  let errorCount = 0;

  targetRows.forEach((rowNumber) => {
    try {
      processRow(sheet, rowNumber);
      successCount++;
    } catch (e) {
      Logger.log(`行${rowNumber}の処理でエラー: ${e.message}`);
      sheet.getRange(rowNumber, COL.STATUS).setValue(STATUS.ERROR);
      errorCount++;
    }
  });

  SpreadsheetApp.getUi().alert(
    `記事生成が完了しました。成功: ${successCount}件 / エラー: ${errorCount}件\n` +
      "詳細は「表示」→「ログ」で確認できます。",
  );
}

/**
 * 今シートで選択されている範囲から、データ行（ヘッダー行より下）の行番号一覧を返す。
 * 1行だけ選んでいれば1件、複数行をまとめて選んでいればその分だけ返す。
 * キーワード列が空の行は対象から除く。
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @return {number[]}
 */
function getSelectedDataRows(sheet) {
  const activeRange = sheet.getActiveRange();
  if (!activeRange) {
    return [];
  }

  const startRow = Math.max(activeRange.getRow(), FIRST_DATA_ROW);
  const endRow = activeRange.getLastRow();
  if (endRow < FIRST_DATA_ROW) {
    // ヘッダー行しか選ばれていない場合
    return [];
  }

  const rows = [];
  for (let rowNumber = startRow; rowNumber <= endRow; rowNumber++) {
    const keyword = sheet.getRange(rowNumber, COL.KEYWORD).getValue();
    if (keyword) {
      rows.push(rowNumber);
    }
  }
  return rows;
}

/**
 * 1行分の記事生成〜書き込みを行う。
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @param {number} rowNumber
 */
function processRow(sheet, rowNumber) {
  const keyword = sheet.getRange(rowNumber, COL.KEYWORD).getValue();
  const subKeywords = sheet.getRange(rowNumber, COL.SUB_KEYWORDS).getValue();

  if (!keyword) {
    throw new Error("キーワードが空です。");
  }

  const prompt = buildPrompt(String(keyword), String(subKeywords || ""));
  const article = callChatGpt(prompt);

  sheet.getRange(rowNumber, COL.TITLE).setValue(article.title);
  sheet.getRange(rowNumber, COL.BODY).setValue(article.body);
  sheet
    .getRange(rowNumber, COL.META_DESCRIPTION)
    .setValue(article.metaDescription);
  // 記事本体の生成・書き込みが完了した時点で「完成」にする。
  // WordPress送信（DRY_RUN=falseのとき）が失敗しても、この完成ステータスは残す
  // （本文の生成自体は成功しているため、上書きで消してしまわないようにする）。
  sheet.getRange(rowNumber, COL.STATUS).setValue(STATUS.DONE);

  notifyWordPress(article);
}

/**
 * WordPressへの送信ペイロードを組み立てて postToWordPress() に渡す。
 * DRY_RUNの間は失敗しない想定だが、実送信（DRY_RUN=false）時にWordPress側が
 * エラーになった場合でも、記事生成自体は成功として扱い、ログにだけ残す。
 * @param {{title: string, body: string, metaDescription: string}} article
 */
function notifyWordPress(article) {
  const payload = buildWordPressPayload(
    article.title,
    article.body,
    article.metaDescription,
  );
  try {
    postToWordPress(payload);
  } catch (e) {
    Logger.log(
      `WordPressへの送信でエラーが発生しましたが、記事生成自体は完了しています: ${e.message}`,
    );
  }
}
