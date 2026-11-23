'use client';

import type { ComponentProps, ReactNode } from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { cn } from '@/lib/cn';

export const Tabs = TabsPrimitive.Root;

export function TabsList({ className, ...props }: ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      className={cn('flex gap-1 overflow-x-auto overflow-y-hidden border-b border-line', className)}
      {...props}
    />
  );
}

export interface TabsTriggerProps extends ComponentProps<typeof TabsPrimitive.Trigger> {
  icon?: ReactNode;
}

export function TabsTrigger({ icon, className, children, ...props }: TabsTriggerProps) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        '-mb-px inline-flex shrink-0 items-center gap-2 whitespace-nowrap border-b-2 border-transparent px-3 py-2.5 text-sm font-medium text-fg-muted outline-none transition-colors duration-150 hover:text-fg rounded-t-md focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/50 data-[state=active]:border-primary data-[state=active]:text-primary',
        className,
      )}
      {...props}
    >
      {icon ? <span className="inline-flex" aria-hidden="true">{icon}</span> : null}
      {children}
    </TabsPrimitive.Trigger>
  );
}

export function TabsContent({ className, ...props }: ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      className={cn('pt-4 outline-none focus-visible:ring-4 focus-visible:ring-focus', className)}
      {...props}
    />
  );
}
