import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from './tooltip';

export const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-[2px] text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 select-none cursor-pointer',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:opacity-90 active:scale-[0.98]',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        outline: 'border border-border bg-transparent hover:bg-secondary/50 text-foreground',
        ghost: 'bg-transparent hover:bg-secondary text-foreground hover:text-foreground',
        active: 'bg-secondary border border-primary text-primary font-semibold',
        danger: 'bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive hover:text-white',
      },
      size: {
        sm: 'h-7 w-7 p-0',
        md: 'h-8 w-8 p-0',
        lg: 'h-9 w-9 p-0',
      },
    },
    defaultVariants: {
      variant: 'ghost',
      size: 'md',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  tooltip?: string;
  tooltipSide?: 'top' | 'right' | 'bottom' | 'left';
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, tooltip, tooltipSide = 'top', children, ...props }, ref) => {
    const btn = (
      <button
        ref={ref}
        className={cn(buttonVariants({ variant, size, className }))}
        {...props}
      >
        {children}
      </button>
    );

    if (tooltip) {
      return (
        <Tooltip delayDuration={600}>
          <TooltipTrigger asChild>{btn}</TooltipTrigger>
          <TooltipContent side={tooltipSide}>{tooltip}</TooltipContent>
        </Tooltip>
      );
    }

    return btn;
  }
);
Button.displayName = 'Button';
