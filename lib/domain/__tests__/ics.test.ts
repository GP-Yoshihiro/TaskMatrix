import { describe, expect, it } from 'vitest'
import { buildIcs, escapeIcsText, foldIcsLine, toIcsUtc } from '@/lib/domain/ics'

describe('escapeIcsText', () => {
  it('バックスラッシュを二重にする', () => {
    expect(escapeIcsText('a\\b')).toBe('a\\\\b')
  })

  it('セミコロンをエスケープする', () => {
    expect(escapeIcsText('a;b')).toBe('a\\;b')
  })

  it('カンマをエスケープする', () => {
    expect(escapeIcsText('a,b')).toBe('a\\,b')
  })

  it('改行をリテラルの \\n にする', () => {
    expect(escapeIcsText('a\nb')).toBe('a\\nb')
    expect(escapeIcsText('a\r\nb')).toBe('a\\nb')
  })

  it('バックスラッシュを先に処理して二重エスケープしない', () => {
    // 入力はバックスラッシュ + セミコロンの 2 文字。\ が \\ に、; が \; になる
    expect(escapeIcsText('\\;')).toBe('\\\\\\;')
  })

  it('日本語はそのまま通す', () => {
    expect(escapeIcsText('設計レビューを実施する')).toBe('設計レビューを実施する')
  })
})

describe('toIcsUtc', () => {
  it('JST を UTC の basic 形式に変換する', () => {
    expect(toIcsUtc('2026-09-01T09:00:00+09:00')).toBe('20260901T000000Z')
  })

  it('すでに UTC ならそのまま整形する', () => {
    expect(toIcsUtc('2026-09-01T00:00:00Z')).toBe('20260901T000000Z')
  })

  it('日付をまたぐ変換も正しい', () => {
    expect(toIcsUtc('2026-09-01T08:00:00+09:00')).toBe('20260831T230000Z')
  })

  it('解釈できない文字列で例外を投げず空文字を返す', () => {
    expect(() => toIcsUtc('いつか')).not.toThrow()
    expect(toIcsUtc('いつか')).toBe('')
  })
})

describe('foldIcsLine', () => {
  it('75 オクテット以内はそのまま返す', () => {
    const line = 'SUMMARY:short'
    expect(foldIcsLine(line)).toBe(line)
  })

  it('75 オクテットを超えたら折り返す', () => {
    const line = 'SUMMARY:' + 'a'.repeat(200)
    const folded = foldIcsLine(line)
    expect(folded).toContain('\r\n ')
    expect(folded.split('\r\n').length).toBeGreaterThan(1)
  })

  it('継続行は空白 1 個で始まる', () => {
    const folded = foldIcsLine('SUMMARY:' + 'a'.repeat(200))
    for (const part of folded.split('\r\n').slice(1)) {
      expect(part.startsWith(' ')).toBe(true)
    }
  })

  it('各行が 75 オクテット以内に収まる', () => {
    const encoder = new TextEncoder()
    const folded = foldIcsLine('SUMMARY:' + 'あ'.repeat(120))
    for (const part of folded.split('\r\n')) {
      expect(encoder.encode(part).length).toBeLessThanOrEqual(75)
    }
  })

  it('マルチバイト文字の途中で折らない', () => {
    // 折り返して繋ぎ直したとき、元の文字がそのまま復元できること
    const original = 'SUMMARY:' + '設計レビューを実施する'.repeat(12)
    const folded = foldIcsLine(original)
    const rejoined = folded.split('\r\n ').join('')
    expect(rejoined).toBe(original)
    expect(folded).not.toContain('�')
  })
})

describe('buildIcs', () => {
  const events = [
    {
      uid: 'abc@taskmatrix',
      startsAt: '2026-09-01T09:00:00+09:00',
      endsAt: '2026-09-01T11:00:00+09:00',
      summary: '設計レビューを実施する',
      description: '優先度が高いため午前に配置しました。',
    },
  ]
  const now = new Date('2026-08-31T12:00:00Z')

  it('VCALENDAR で囲む', () => {
    const ics = buildIcs(events, now)
    expect(ics.startsWith('BEGIN:VCALENDAR')).toBe(true)
    expect(ics.trimEnd().endsWith('END:VCALENDAR')).toBe(true)
  })

  it('VERSION と PRODID を含む', () => {
    const ics = buildIcs(events, now)
    expect(ics).toContain('VERSION:2.0')
    expect(ics).toContain('PRODID:')
  })

  it('イベント数だけ VEVENT がある', () => {
    const ics = buildIcs([...events, { ...events[0], uid: 'def@taskmatrix' }], now)
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2)
    expect(ics.match(/END:VEVENT/g)).toHaveLength(2)
  })

  it('改行が CRLF である', () => {
    const ics = buildIcs(events, now)
    expect(ics).toContain('\r\n')
    expect(ics.replace(/\r\n/g, '')).not.toContain('\n')
  })

  it('SUMMARY にタスク名が入る', () => {
    expect(buildIcs(events, now)).toContain('設計レビューを実施する')
  })

  it('DESCRIPTION に算出理由が入る', () => {
    expect(buildIcs(events, now)).toContain('優先度が高いため午前に配置しました。')
  })

  it('DTSTART と DTEND が UTC 形式', () => {
    const ics = buildIcs(events, now)
    expect(ics).toContain('DTSTART:20260901T000000Z')
    expect(ics).toContain('DTEND:20260901T020000Z')
  })

  it('DTSTAMP に生成時刻が入る', () => {
    expect(buildIcs(events, now)).toContain('DTSTAMP:20260831T120000Z')
  })

  it('イベントが 0 件でも壊れない', () => {
    const ics = buildIcs([], now)
    expect(ics).toContain('BEGIN:VCALENDAR')
    expect(ics).not.toContain('BEGIN:VEVENT')
  })

  it('セミコロンを含むタスク名をエスケープする', () => {
    const ics = buildIcs([{ ...events[0], summary: 'A;B' }], now)
    expect(ics).toContain('A\\;B')
  })
})
