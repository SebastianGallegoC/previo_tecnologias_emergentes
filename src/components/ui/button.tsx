import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98] select-none',
  {
    variants: {
      variant: {
        // Iconic Uber Daylight primary black button
        default:
          'bg-neutral-900 text-white hover:bg-neutral-800 shadow-sm',
        // Emerald transit action
        emerald:
          'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm',
        destructive:
          'bg-rose-600 text-white hover:bg-rose-700 shadow-sm',
        outline:
          'border border-neutral-300 bg-white text-neutral-800 hover:bg-neutral-50 hover:border-neutral-400',
        secondary:
          'bg-neutral-100 text-neutral-900 hover:bg-neutral-200',
        ghost:
          'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900',
        amber:
          'bg-amber-50 text-amber-900 border border-amber-300 hover:bg-amber-100',
      },
      size: {
        default: 'h-11 px-4 py-2.5',
        sm: 'h-9 rounded-lg px-3 text-xs',
        lg: 'h-12 rounded-xl px-5 text-sm font-bold',
        icon: 'h-10 w-10 rounded-xl',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { buttonVariants };
