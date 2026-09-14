/**
 * 表の構造がそろっているかの確認。
 *
 * 移行 SQL の適用漏れは、これまで 2 度起きている（0017 と 0018）。
 * いずれも「適用した」あとで実際には列が無く、画面が使えなくなった。
 *
 * **アプリの外から確かめられる手段が無かった**ため、
 * 毎回やり取りを重ねて切り分けることになっていた。
 * ここで期待する列を一覧にし、`/api/health` から確かめられるようにする。
 *
 * **返すのは列の名前と有無だけで、データの中身は一切含めない。**
 */

export type ExpectedTable = {
  table: string
  /** 問い合わせに使う列。`表(列)` の形は結合を表す */
  columns: string[]
}

/**
 * 期待する表と列。
 *
 * 全列ではなく、**あとから足したもの**を中心に並べる。
 * 適用漏れが起きるのは追加分であり、全列を書くと更新が追いつかない。
 */
export const EXPECTED_SCHEMA: ExpectedTable[] = [
  {
    table: 'tasks',
    columns: [
      'assignee_member_id',
      'estimated_days',
      'estimate_source',
      'project_members(name)',
    ],
  },
  { table: 'project_members', columns: ['name'] },
  { table: 'sections', columns: ['name', 'position'] },
  { table: 'member_sections', columns: ['member_id', 'section_id'] },
  { table: 'invitations', columns: ['code_hash', 'code_encrypted', 'expires_at'] },
  { table: 'limit_notifications', columns: ['reached_on', 'reason', 'read_at'] },
  { table: 'schedules', columns: ['google_event_id'] },
  { table: 'google_connections', columns: ['needs_reconnect'] },
  { table: 'history_entries', columns: ['changes'] },
  { table: 'ai_usage_logs', columns: ['input_tokens', 'output_tokens'] },
  { table: 'profiles', columns: ['is_admin'] },
]

export type TableCheck = {
  table: string
  ok: boolean
  missing: string[]
}

/**
 * エラー文から、足りていない列を拾う。
 *
 * 問い合わせは 1 度で行うため、どの列が原因かはメッセージからしか分からない。
 */
export function missingColumnsFrom(message: string, columns: string[]): string[] {
  if (message === '') return []

  return columns.filter((column) => {
    // `表(列)` は結合。PostgREST は「関係が見つからない」と返す
    const joined = column.match(/^([a-z_]+)\(/)
    if (joined) return message.includes(joined[1])

    return message.includes(column)
  })
}

/** 画面・応答に出す形にまとめる */
export function summarizeSchemaChecks(checks: TableCheck[]): {
  ok: boolean
  missing: string[]
} {
  const missing = checks.flatMap((check) => {
    if (check.ok) return []

    // 原因が分からない失敗を「問題なし」と見せない
    if (check.missing.length === 0) return [`${check.table}（原因不明）`]

    return check.missing.map((column) => `${check.table}.${column}`)
  })

  return { ok: missing.length === 0, missing }
}
