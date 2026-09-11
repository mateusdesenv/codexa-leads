type LeadAction = 'phone' | 'whatsapp' | 'website' | 'maps'

/** Action-specific icons share one optical size and inherit the button color. */
export default function LeadActionIcon({ action }: { action: LeadAction }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" className="lead-action-icon">
      {action === 'phone' && (
        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.2 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.12.96.36 1.91.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.85.58 2.81.7A2 2 0 0 1 22 16.92Z" />
      )}
      {action === 'whatsapp' && <>
        <path d="M20.5 11.7a8.5 8.5 0 0 1-12.6 7.5L3 20.5l1.3-4.8A8.5 8.5 0 1 1 20.5 11.7Z" />
        <path d="m8.5 7.2 1.1 2.4-1 1.1c.7 1.6 1.9 2.8 3.5 3.5l1.1-1 2.4 1.1c.3.2.3.6.2.9-.4 1-1.2 1.5-2.2 1.3-3.7-.8-6.4-3.5-7.2-7.2-.2-1 .3-1.8 1.3-2.2.3-.1.7-.1.8.1Z" fill="currentColor" stroke="none" />
      </>}
      {action === 'website' && <>
        <circle cx="12" cy="12" r="9" />
        <ellipse cx="12" cy="12" rx="4" ry="9" />
        <path d="M3 12h18M5 6.5h14M5 17.5h14" />
      </>}
      {action === 'maps' && <>
        <path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z" />
        <circle cx="12" cy="10" r="2.75" />
      </>}
    </svg>
  )
}
