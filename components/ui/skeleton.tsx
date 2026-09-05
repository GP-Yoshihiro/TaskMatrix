/**
 * 読み込み中の骨組み。
 *
 * 中身の代わりに、これから出るものと同じ大きさの面を置く。
 * 空白のまま待たせるより、何が来るのかが伝わり、
 * 中身が入れ替わったときに画面が跳ねない。
 */
export function Skeleton({
  width = '100%',
  height = 16,
  radius = 'var(--radius-sm)',
}: {
  width?: number | string
  height?: number | string
  radius?: string
}) {
  return (
    <span
      aria-hidden="true"
      style={{
        display: 'block',
        width,
        height,
        borderRadius: radius,
        background: 'var(--color-border)',
        // 動きで「止まっていない」ことを伝える
        animation: 'tm-skeleton 1.4s ease-in-out infinite',
      }}
    />
  )
}
