'use client'

type BadgeVariant = 'default' | 'pk' | 'fk' | 'nn' | 'type' | 'count'

const variants: Record<BadgeVariant, string> = {
  default: 'bg-surface-hover text-gray-400',
  pk:      'bg-yellow-900/30 text-yellow-500',
  fk:      'bg-violet-900/30 text-violet-400',
  nn:      'bg-yellow-900/20 text-yellow-600',
  type:    'text-gray-500',
  count:   'text-gray-600',
}

export default function Badge({
  variant = 'default',
  className = '',
  children,
}: {
  variant?: BadgeVariant
  className?: string
  children: React.ReactNode
}) {
  return (
    <span
      className={`inline-flex items-center px-1 py-0.5 text-[10px] font-medium rounded
        leading-none ${variants[variant]} ${className}`}
    >
      {children}
    </span>
  )
}
