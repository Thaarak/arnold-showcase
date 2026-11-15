import { ArrowUpRight, Flame, Footprints, Target } from 'lucide-react'
import Link from 'next/link'
import { todayTotals, type Journal } from '@/lib/entries'

function Metric({ title, amount, goal, unit }: { title: string; amount: number; goal: number; unit: string }) {
  return <div className="metric">
    <div><span>{title}</span><strong>{Math.round(amount)} <small>/ {goal} {unit}</small></strong></div>
    <progress aria-label={title} value={Math.min(amount, goal)} max={goal} />
  </div>
}

export function Progress({ journal }: { journal: Journal }) {
  const totals = todayTotals(journal.entries)
  return (
    <aside className="panel progress-panel" aria-label="Today’s totals">
      <div className="panel-heading"><Target size={18} aria-hidden="true" /><h2>Today’s log</h2></div>
      <div className="progress-body">
        <Metric title="Energy" amount={totals.calories} goal={journal.goals.calories} unit="kcal" />
        <Metric title="Protein" amount={totals.protein} goal={journal.goals.protein} unit="g" />
        <div className="workout-count"><Footprints size={17} aria-hidden="true" /><span>Workouts</span><strong>{totals.workouts}</strong></div>
        <Link href="/meals" className="text-link"><Flame size={16} aria-hidden="true" /> View nutrition <ArrowUpRight size={15} aria-hidden="true" /></Link>
      </div>
    </aside>
  )
}
