import type { ReactNode } from 'react'

export function ComingSoon({ icon, title = 'Bientôt', children }: { icon: ReactNode; title?: string; children: ReactNode }) {
  return (
    <div className="coming-soon">
      <div className="coming-soon-icon">{icon}</div>
      <p className="coming-soon-title">{title}</p>
      <p className="coming-soon-text">{children}</p>
    </div>
  )
}
