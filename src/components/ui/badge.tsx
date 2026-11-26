import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tracking-tight transition-colors focus:outline-none',
  {
    variants: {
      variant: {
        default:
          'border-transparent bg-neutral-900 text-white',
        emerald:
          'border-emerald-200 bg-emerald-50 text-emerald-800',
        blue:
          'border-sky-200 bg-sky-50 text-sky-800',
        amber:
          'border-amber-200 bg-amber-50 text-amber-900',
        rose:
          'border-rose-200 bg-rose-50 text-rose-800',
        purple:
          'border-violet-200 bg-violet-50 text-violet-800',
        outline:
          'border-neutral-200 bg-neutral-50 text-neutral-700',
        locked:
          'border-neutral-200 bg-neutral-100 text-neutral-600',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}
