'use client'

import { Activity, Dumbbell, MessageSquare, Utensils } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const links = [
  { href: '/', label: 'Coach', Icon: MessageSquare },
  { href: '/meals', label: 'Nutrition', Icon: Utensils },
  { href: '/workouts', label: 'Training', Icon: Dumbbell },
]

export function Navigation() {
  const current = usePathname()
  return (
    <header className="masthead">
      <div className="wrap masthead-inner">
        <Link href="/" className="brand" aria-label="Arnold home"><span><Activity size={21} /></span> Arnold</Link>
        <nav aria-label="Main navigation">
          {links.map(({ href, label, Icon }) => (
            <Link key={href} href={href} aria-current={href === current ? 'page' : undefined}>
              <Icon size={17} aria-hidden="true" />{label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  )
}
