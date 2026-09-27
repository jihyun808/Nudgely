import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-primary-foreground hover:bg-primary/90',
        kakao: 'bg-[#FEE500] text-[#191600] hover:bg-[#FEE500]/90',
        outline: 'border border-input bg-background hover:bg-muted-foreground/5',
      },
      size: {
        default: 'h-10 px-4 py-2',
        lg: 'h-12 px-6',
        sm: 'h-10 px-6',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'default',
    },
  },
);

interface ButtonProps extends React.ComponentProps<'button'>, VariantProps<typeof buttonVariants> {}

function Button({ className, variant, size, ...props }: ButtonProps) {
  return (
    <button
      data-slot="button"
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}

// 컴포넌트만 내보낸다 (다른 값을 함께 내보내면 Fast Refresh가 동작하지 않는다)
export { Button };
