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

export const ChevronRightIcon = () => (
  <Icon>
    <path d="M9 18l6-6-6-6" />
  </Icon>
)

export const ChevronDownIcon = () => (
  <Icon>
    <path d="M6 9l6 6 6-6" />
  </Icon>
)

export const ArrowUpIcon = () => (
  <Icon>
    <path d="M12 19V5M5 12l7-7 7 7" />
  </Icon>
)

export const ArrowDownIcon = () => (
  <Icon>
    <path d="M12 5v14M5 12l7 7 7-7" />
  </Icon>
)

export const CloseIcon = () => (
  <Icon>
    <path d="M18 6L6 18M6 6l12 12" />
  </Icon>
)

export const PlusIcon = () => (
  <Icon>
    <path d="M12 5v14M5 12h14" />
  </Icon>
)

export const MinusIcon = () => (
  <Icon>
    <path d="M5 12h14" />
  </Icon>
)

export const CheckIcon = () => (
  <Icon>
    <path d="M20 6L9 17l-5-5" />
  </Icon>
)

export const CopyIcon = () => (
  <Icon>
    <rect x="9" y="9" width="12" height="12" rx="2.5" />
    <path d="M5 15H4.5A1.5 1.5 0 013 13.5v-9A1.5 1.5 0 014.5 3h9A1.5 1.5 0 0115 4.5V5" />
  </Icon>
)

export const TrophyIcon = () => (
  <Icon>
    <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 01-10 0V4z" />
    <path d="M17 6h2.5a1.5 1.5 0 011.5 1.5V8a4 4 0 01-4 4M7 6H4.5A1.5 1.5 0 003 7.5V8a4 4 0 004 4" />
  </Icon>
)

export const MoonIcon = () => (
  <Icon>
    <path d="M20 14.5A8 8 0 019.5 4a8 8 0 1010.5 10.5z" />
  </Icon>
)

export const InfoIcon = () => (
  <Icon>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5M12 8h.01" />
  </Icon>
)

export const ShieldIcon = () => (
  <Icon>
    <path d="M12 3l7 3v5c0 4.5-3 8.2-7 10-4-1.8-7-5.5-7-10V6z" />
  </Icon>
)
