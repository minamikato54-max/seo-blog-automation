/**
 * スプレッドシートを開いたときに、カスタムメニューを追加する。
 * 記事を作りたいキーワードの行（1行、または複数行）を選択してから、このメニューを押す方式
 * （onEditの自動発火ではなく、ボタン操作で確実に起動する）。
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("記事作成自動化")
    .addItem("記事を生成", "generateArticles")
    .addToUi();
}
