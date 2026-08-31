export type CalendarCell = {
  /** YYYY-MM-DD */
  date: string
  /** 表示している月の日かどうか。前月・翌月の日は false */
  inCurrentMonth: boolean
  /** 0=日曜 〜 6=土曜 */
  weekday: number
}

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

function toDateString(year: number, month: number, day: number): string {
  return `${year}-${pad(month)}-${pad(day)}`
}

/**
 * 月間カレンダーのグリッドを組み立てる。
 *
 * 週の開始は日曜。前月・翌月の日を詰めて各週を必ず 7 セルにする。
 * Date の月は 0 始まりだが、この関数の month は 1 始まりで扱う。
 */
export function buildMonthGrid(year: number, month: number): CalendarCell[][] {
  const firstOfMonth = new Date(Date.UTC(year, month - 1, 1))
  const leading = firstOfMonth.getUTCDay()
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()

  const cells: CalendarCell[] = []

  // 前月の日を詰める
  for (let offset = leading; offset > 0; offset--) {
    const date = new Date(Date.UTC(year, month - 1, 1 - offset))
    cells.push({
      date: toDateString(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate()),
      inCurrentMonth: false,
      weekday: date.getUTCDay(),
    })
  }

  // 当月
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(Date.UTC(year, month - 1, day))
    cells.push({
      date: toDateString(year, month, day),
      inCurrentMonth: true,
      weekday: date.getUTCDay(),
    })
  }

  // 末尾を土曜まで埋める
  while (cells.length % 7 !== 0) {
    const offset = cells.length - leading - daysInMonth + 1
    const date = new Date(Date.UTC(year, month - 1, daysInMonth + offset))
    cells.push({
      date: toDateString(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate()),
      inCurrentMonth: false,
      weekday: date.getUTCDay(),
    })
  }

  const weeks: CalendarCell[][] = []
  for (let index = 0; index < cells.length; index += 7) {
    weeks.push(cells.slice(index, index + 7))
  }
  return weeks
}

export function shiftMonth(
  year: number,
  month: number,
  delta: number,
): { year: number; month: number } {
  const date = new Date(Date.UTC(year, month - 1 + delta, 1))
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 }
}

export function formatMonthLabel(year: number, month: number): string {
  return `${year}年${month}月`
}
