import { LoadingPanel } from '@/components/ui/loading-panel'

export default function Loading() {
  // 中身が多い画面。骨組みも同じくらいの高さにして、入れ替わりで跳ねないようにする
  return <LoadingPanel rows={5} />
}
