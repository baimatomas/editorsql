'use client'

import { type ButtonHTMLAttributes, forwardRef } from 'react'

type Variant = 'toolbar' | 'tab' | 'tab-active' | 'primary' | 'secondary' | 'ghost' | 'icon'

const variants: Record<Variant, string> = {
  toolbar:    'text-gray-400 hover:text-white hover:bg-white/10 active:bg-white/15 px-2',
  tab:        'text-gray-500 hover:text-gray-300 px-2.5 border-b-2 border-transparent',
  'tab-active':'text-white border-b-2 border-institutional-400 bg-institutional-700/40 px-2.5',
  primary:    'bg-institutional-600 hover:bg-institutional-500 active:bg-institutional-700 text-white shadow-sm px-3',
  secondary:  'bg-surface-hover hover:bg-surface-border active:bg-surface-elevated text-gray-300 px-3',
  ghost:      'text-gray-400 hover:text-white hover:bg-surface-hover active:bg-surface-border px-2',
  icon:       'text-gray-400 hover:text-white hover:bg-surface-hover active:bg-surface-border px-1.5',
}

const height = 'h-7'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'secondary', className = '', children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={`inline-flex items-center justify-center gap-1.5 rounded-md text-xs font-medium
          transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed
          ${height} ${variants[variant]} ${className}`}
        {...props}
      >
        {children}
      </button>
    )
  }
)
Button.displayName = 'Button'

export default Button
