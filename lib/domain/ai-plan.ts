/**
 * 利用枠を増やすときに開く画面。
 *
 * **このファイルはサーバー側からのみ読み込むこと。**
 * URL に Google Cloud のプロジェクト ID が含まれるため、
 * クライアント側の部品から読み込むと、全利用者のブラウザへ配られてしまう。
 * 画面へは、管理者向けの描画のときにだけ値として渡す。
 *
 * 秘密情報ではないが、渡す必要のないものを渡さない。
 */
export const AI_STUDIO_PLAN_URL =
  'https://aistudio.google.com/app/projects?project=gen-lang-client-0561831696'
