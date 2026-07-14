import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-lg hover:shadow-emerald-500/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-none [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground shadow hover:bg-emerald-700 hover:text-white hover:ring-2 hover:ring-emerald-300/70',
        destructive: 'bg-destructive text-destructive-foreground shadow-sm hover:bg-red-600 hover:ring-2 hover:ring-red-300/70',
        outline: 'border border-input bg-background shadow-sm hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-900 hover:ring-2 hover:ring-emerald-200/80',
        secondary: 'bg-secondary text-secondary-foreground shadow-sm hover:bg-emerald-50 hover:text-emerald-900 hover:ring-2 hover:ring-emerald-200/70',
        ghost: 'hover:bg-emerald-50 hover:text-emerald-900 hover:ring-2 hover:ring-emerald-200/70',
        link: 'text-primary underline-offset-4 hover:text-emerald-700 hover:underline hover:shadow-none',
      },
      size: {
        default: 'h-9 px-3 py-1.5 text-xs',
        sm: 'h-9 rounded-md px-3 text-xs',
        lg: 'h-10 rounded-lg px-5 text-sm',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
  }
)
Button.displayName = 'Button'

export { Button, buttonVariants }
