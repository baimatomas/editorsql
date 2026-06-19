'use client'

import { type ButtonHTMLAttributes, forwardRef } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'outline' | 'icon'

const variants: Record<Variant, string> = {
  primary:   'bg-institutional-600 hover:bg-institutional-500 text-white shadow-sm',
  secondary: 'bg-[#0e639c] hover:bg-[#1177bb] text-white shadow-sm',
  ghost:     'text-gray-400 hover:text-white hover:bg-surface-hover',
  outline:   'border border-surface-border text-gray-300 hover:text-white hover:bg-surface-hover',
  icon:      'text-gray-400 hover:text-white hover:bg-surface-hover p-1',
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'outline', className = '', children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={`inline-flex items-center justify-center gap-1.5 rounded-md text-xs font-medium
          transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed
          ${variants[variant]} ${className}`}
        {...props}
      >
        {children}
      </button>
    )
  }
)
Button.displayName = 'Button'

export default Button
