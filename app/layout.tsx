import type { Metadata } from 'next'
import '@fontsource/barlow-condensed/latin-700.css'
import '@fontsource-variable/instrument-sans/index.css'
import { Navigation } from '@/components/navigation'
import './globals.css'

export const metadata: Metadata = {
  title: { default: 'Arnold | Fitness journal', template: '%s | Arnold' },
  description: 'Log meals and workouts by voice or text, review the details, and track your goals.',
  icons: { icon: '/arnold.svg' },
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><Navigation /><main id="main" className="wrap workspace">{children}</main></body></html>
}
