import type { ReactNode } from 'react';

const common = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.75, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

function Svg({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" className="shrink-0" {...common}>
      {children}
    </svg>
  );
}

export const NAV_ICONS: Record<string, ReactNode> = {
  '/dashboard': (
    <Svg>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.2" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.2" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.2" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.2" />
    </Svg>
  ),
  '/queues': (
    <Svg>
      <rect x="3.5" y="4.5" width="4" height="4" rx="0.8" />
      <path d="M10 6.5h10.5" />
      <rect x="3.5" y="14.5" width="4" height="4" rx="0.8" />
      <path d="M10 16.5h10.5" />
    </Svg>
  ),
  '/claims': (
    <Svg>
      <path d="M6 2.75h9l3 3v14.5a1 1 0 01-1 1H6a1 1 0 01-1-1V3.75a1 1 0 011-1z" />
      <path d="M15 2.75v3h3" />
      <path d="M8 12h8M8 15.5h8M8 8.5h4" />
    </Svg>
  ),
  '/payments': (
    <Svg>
      <rect x="2.75" y="5.5" width="18.5" height="13" rx="1.6" />
      <path d="M2.75 9.5h18.5" />
      <path d="M6 14.5h4" />
    </Svg>
  ),
  '/authorizations': (
    <Svg>
      <path d="M12 3l7 2.7v5.4c0 4.6-3 8.1-7 9.9-4-1.8-7-5.3-7-9.9V5.7L12 3z" />
      <path d="M9 12l2 2 4-4.2" />
    </Svg>
  ),
  '/schedule': (
    <Svg>
      <rect x="3.5" y="4.5" width="17" height="16" rx="1.6" />
      <path d="M3.5 9.5h17" />
      <path d="M8 2.5v4M16 2.5v4" />
      <circle cx="8.5" cy="13.5" r="1" fill="currentColor" stroke="none" />
      <circle cx="12.5" cy="13.5" r="1" fill="currentColor" stroke="none" />
      <circle cx="8.5" cy="17" r="1" fill="currentColor" stroke="none" />
    </Svg>
  ),
  '/patients': (
    <Svg>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M4.5 20.5c0-4.1 3.4-6.5 7.5-6.5s7.5 2.4 7.5 6.5" />
    </Svg>
  ),
  '/batches': (
    <Svg>
      <path d="M12 3l8.5 4.3L12 11.6 3.5 7.3 12 3z" />
      <path d="M3.5 12.3L12 16.6l8.5-4.3" />
      <path d="M3.5 17L12 21.3 20.5 17" />
    </Svg>
  ),
  '/reports': (
    <Svg>
      <path d="M4 20.5V10M12 20.5V4M20 20.5v-7" />
      <path d="M2.5 20.5h19" />
    </Svg>
  ),
  '/claim-status': (
    <Svg>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12.5l2.2 2.3L16 9.5" />
    </Svg>
  ),
  '/eligibility': (
    <Svg>
      <rect x="2.75" y="4.5" width="18.5" height="15" rx="1.8" />
      <circle cx="8" cy="11" r="2.2" />
      <path d="M4.8 17c.5-1.9 2-3 3.2-3s2.7 1.1 3.2 3" />
      <path d="M14 9.5h4M14 13h4" />
    </Svg>
  ),
  setup: (
    <Svg>
      <path d="M14.7 3.3l1.9 1.9-9.9 9.9-2.6.7.7-2.6 9.9-9.9z" />
      <path d="M4 20.5h16" />
    </Svg>
  ),
  automation: (
    <Svg>
      <path d="M13 2.5L4.5 13.5H11l-1 8 9-11.5h-6.5l0.5-7.5z" />
    </Svg>
  ),
  'claim-statuses': (
    <Svg>
      <path d="M12.5 3H5a1.2 1.2 0 00-1.2 1.2V12l9.4 9.4a1.2 1.2 0 001.7 0l7.1-7.1a1.2 1.2 0 000-1.7L12.5 3z" />
      <circle cx="8.2" cy="8.2" r="1.3" fill="currentColor" stroke="none" />
    </Svg>
  ),
  rules: (
    <Svg>
      <path d="M4 4.5h16L14 13v6.5l-4 1.5V13L4 4.5z" />
    </Svg>
  ),
  'fee-schedules': (
    <Svg>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 6.5v11M14.8 9c0-1.2-1.2-2-2.8-2s-2.8.9-2.8 2.1c0 3 5.6 1.4 5.6 4.3 0 1.3-1.2 2.1-2.8 2.1s-2.8-.7-2.8-2" />
    </Svg>
  ),
  providers: (
    <Svg>
      <circle cx="12" cy="7.5" r="3.3" />
      <path d="M5 20.5c0-3.9 3.1-6.2 7-6.2s7 2.3 7 6.2" />
      <path d="M12 14.3v2M11 15.3h2" />
    </Svg>
  ),
  organization: (
    <Svg>
      <rect x="4.5" y="3.5" width="10" height="17" rx="1" />
      <path d="M14.5 9.5h5v11h-5" />
      <path d="M7.5 7h1M11 7h1M7.5 10.5h1M11 10.5h1M7.5 14h1M11 14h1" />
    </Svg>
  ),
  edi: (
    <Svg>
      <path d="M4 8h13" />
      <path d="M13.5 4.5L17 8l-3.5 3.5" />
      <path d="M20 16H7" />
      <path d="M10.5 12.5L7 16l3.5 3.5" />
    </Svg>
  ),
  audit: (
    <Svg>
      <rect x="5" y="3.5" width="14" height="17" rx="1.4" />
      <rect x="8.5" y="2.2" width="7" height="3" rx="0.8" />
      <path d="M8.5 11h7M8.5 14.5h7M8.5 18h4" />
    </Svg>
  ),
  users: (
    <Svg>
      <circle cx="9" cy="8.5" r="3" />
      <path d="M3.3 19.5c0-3.3 2.6-5.2 5.7-5.2s5.7 1.9 5.7 5.2" />
      <path d="M15.5 6a2.6 2.6 0 010 5.1" />
      <path d="M16.7 14.6c2.4.4 3.9 2.1 3.9 4.9" />
    </Svg>
  ),
};
