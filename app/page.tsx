import { Coach } from '@/components/coach'
import { liveMode } from '@/lib/providers'

export const dynamic = 'force-dynamic'

export default function Home() {
  return <Coach live={liveMode()} />
}
