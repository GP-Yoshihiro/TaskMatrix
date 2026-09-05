import { LoadingPanel } from '@/components/ui/loading-panel'

/**
 * (app) 配下すべての受け皿。
 *
 * これがあることで、リンクを押した瞬間に画面が切り替わる。
 * 無いと、サーバー側の処理が終わるまで前の画面のまま止まって見える。
 */
export default function Loading() {
  return <LoadingPanel />
}
