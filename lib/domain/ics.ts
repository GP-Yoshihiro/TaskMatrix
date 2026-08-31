export type IcsEvent = {
  uid: string
  startsAt: string
  endsAt: string
  summary: string
  description: string
}

/** RFC 5545 のテキスト値に必要なエスケープ。バックスラッシュを先に処理する */
export function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n/g, '\\n')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\n')
}

/** ISO 8601 を UTC の basic 形式 YYYYMMDDTHHMMSSZ に変換する */
export function toIcsUtc(isoDateTime: string): string {
  const date = new Date(isoDateTime)
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

/**
 * 1 行を 75 オクテット以内に折り返す。
 *
 * 文字数ではなくバイト数で数える必要がある。
 * 日本語は 1 文字 3 バイトになるため、文字数で数えると上限を超え、
 * バイト位置で機械的に切るとマルチバイト文字が壊れる。
 * 文字単位で足しながらバイト数を見て、文字の途中では折らない。
 */
export function foldIcsLine(line: string): string {
  const encoder = new TextEncoder()
  if (encoder.encode(line).length <= 75) return line

  const parts: string[] = []
  let current = ''
  let currentBytes = 0
  // 継続行は先頭に空白 1 個が付くため、2 行目以降は 74 バイトまで
  let limit = 75

  for (const char of line) {
    const size = encoder.encode(char).length
    if (currentBytes + size > limit) {
      parts.push(current)
      current = char
      currentBytes = size
      limit = 74
    } else {
      current += char
      currentBytes += size
    }
  }
  parts.push(current)

  return parts.join('\r\n ')
}

/** RFC 5545 に沿った .ics 文字列を組み立てる。改行は CRLF */
export function buildIcs(events: IcsEvent[], now: Date = new Date()): string {
  const stamp = toIcsUtc(now.toISOString())

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//TaskMatrix//JA',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ]

  for (const event of events) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:${event.uid}`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${toIcsUtc(event.startsAt)}`,
      `DTEND:${toIcsUtc(event.endsAt)}`,
      `SUMMARY:${escapeIcsText(event.summary)}`,
      `DESCRIPTION:${escapeIcsText(event.description)}`,
      'END:VEVENT',
    )
  }

  lines.push('END:VCALENDAR')

  return lines.map(foldIcsLine).join('\r\n') + '\r\n'
}
