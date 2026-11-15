import type { Metadata } from 'next'
import { LogPage } from '@/components/log-page'

export const metadata: Metadata = { title: 'Nutrition' }

export default function Nutrition() {
  return <LogPage category="meal" />
}
