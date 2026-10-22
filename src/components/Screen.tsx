import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { SettingsIcon } from './icons'

interface ScreenProps {
  title: string
  subtitle?: string
  leading?: ReactNode
  trailing?: ReactNode
  children: ReactNode
}

/** Un écran : en-tête fixe + contenu qui défile (seul élément qui défile dans l'appli). */
export function Screen({ title, subtitle, leading, trailing, children }: ScreenProps) {
  return (
    <section className="screen">
      <header className="screen-header">
        {leading}
        <div className="screen-heading">
          <h1 className="screen-title">{title}</h1>
          {subtitle && <p className="screen-subtitle">{subtitle}</p>}
        </div>
        {trailing}
      </header>
      <div className="screen-content">{children}</div>
    </section>
  )
}

export function SettingsLink() {
  return (
    <Link to="/reglages" className="icon-btn" aria-label="Réglages">
      <SettingsIcon />
    </Link>
  )
}
