import type { ReactNode, SVGProps } from 'react'

function Icon({ children, ...props }: SVGProps<SVGSVGElement> & { children: ReactNode }) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  )
}

export const DumbbellIcon = () => (
  <Icon>
    <path d="M6.5 6.5v11M17.5 6.5v11M3.5 9.5v5M20.5 9.5v5M6.5 12h11" />
  </Icon>
)

export const ProgressIcon = () => (
  <Icon>
    <path d="M3 17l6-6 4 4 8-8" />
    <path d="M15 7h6v6" />
  </Icon>
)

export const CalendarIcon = () => (
  <Icon>
    <rect x="3.5" y="4.5" width="17" height="16" rx="3" />
    <path d="M3.5 9.5h17M8 2.5v4M16 2.5v4" />
  </Icon>
)

export const PillIcon = () => (
  <Icon>
    <g transform="rotate(-45 12 12)">
      <rect x="3" y="8.5" width="18" height="7" rx="3.5" />
      <path d="M12 8.5v7" />
    </g>
  </Icon>
)

export const SettingsIcon = () => (
  <Icon>
    <path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
    <circle cx="15" cy="7" r="2" />
    <circle cx="9" cy="17" r="2" />
  </Icon>
)

export const ChevronLeftIcon = () => (
  <Icon>
    <path d="M15 18l-6-6 6-6" />
  </Icon>
)

export const ShieldIcon = () => (
  <Icon>
    <path d="M12 3l7 3v5c0 4.5-3 8.2-7 10-4-1.8-7-5.5-7-10V6z" />
  </Icon>
)
