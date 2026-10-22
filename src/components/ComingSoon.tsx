import type { ReactNode } from 'react'

export function ComingSoon({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className="coming-soon">
      <div className="coming-soon-icon">{icon}</div>
      <p className="coming-soon-title">Bientôt</p>
      <p className="coming-soon-text">{children}</p>
    </div>
  )
}
