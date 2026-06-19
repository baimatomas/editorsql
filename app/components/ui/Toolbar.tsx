'use client'

export default function Toolbar({
  className = '',
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  return (
    <div
      className={`flex items-center justify-between gap-2 px-3 py-1.5 bg-surface-card
        border-b border-surface-border flex-shrink-0 shadow-sm ${className}`}
    >
      {children}
    </div>
  )
}
