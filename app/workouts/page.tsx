import type { Metadata } from 'next'
import { LogPage } from '@/components/log-page'
import { liveMode } from '@/lib/providers'

export const metadata: Metadata = { title: 'Training' }
export const dynamic = 'force-dynamic'

export default function Training() {
  return <LogPage category="workout" live={liveMode()} />
}
