import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { CalendarIcon, DumbbellIcon, PillIcon, ProgressIcon } from './icons'

const TABS: { to: string; label: string; icon: ReactNode }[] = [
  { to: '/', label: 'Aujourd’hui', icon: <DumbbellIcon /> },
  { to: '/progres', label: 'Progrès', icon: <ProgressIcon /> },
  { to: '/annee', label: 'Mon année', icon: <CalendarIcon /> },
  { to: '/complements', label: 'Compléments', icon: <PillIcon /> },
]

export function TabBar() {
  return (
    <nav className="tabbar" aria-label="Navigation principale">
      {TABS.map((tab) => (
        <NavLink key={tab.to} to={tab.to} end={tab.to === '/'} className="tab">
          {tab.icon}
          <span>{tab.label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
