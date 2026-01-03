'use client';

import React, { memo, useMemo } from 'react';
import { usePathname } from 'next/navigation';
import {
  Terminal,
  Layers,
  ListTodo,
  Network,
  Settings,
  Grid3X3,
  Workflow,
  ChevronLeft,
  ChevronRight,
  Zap,
  Users,
  Phone,
  Calendar,
  Activity,
  Boxes,
  FileCode,
  Link,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { ElectronLink } from '@/components/electron-link';

interface NavItem {
  title: string;
  href: string;
  icon: React.ElementType;
  badge?: string;
}

const navItems: NavItem[] = [
  { title: 'Command Center', href: '/', icon: Terminal },
  { title: 'Workspaces', href: '/workspaces', icon: Layers },
  { title: 'Tasks', href: '/tasks', icon: ListTodo },
  { title: 'Scheduler', href: '/scheduler', icon: Calendar },
  { title: 'Monitoring', href: '/monitoring', icon: Activity },
  { title: 'Browser Grid', href: '/browser-grid', icon: Grid3X3 },
  { title: 'Workflow Builder', href: '/workflow-builder', icon: FileCode },
  { title: 'Templates', href: '/templates', icon: Boxes },
  { title: 'Workflows', href: '/workflows', icon: Workflow },
  { title: 'Accounts', href: '/accounts', icon: Users },
  { title: 'Phone Numbers', href: '/phone-numbers', icon: Phone },
  { title: 'Proxies', href: '/proxies', icon: Network },
  { title: 'Proxy Allocation', href: '/proxy-allocation', icon: Link },
  { title: 'Settings', href: '/settings', icon: Settings },
];

interface SidebarProps {
  collapsed?: boolean;
  onToggle?: () => void;
}

// Memoized nav link component
const NavLink = memo(function NavLink({
  item,
  isActive,
  collapsed,
}: {
  item: NavItem;
  isActive: boolean;
  collapsed: boolean;
}) {
  const NavIcon = item.icon;

  return (
    <ElectronLink
      href={item.href}
      className={cn(
        'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
        'hover:bg-accent/10 hover:text-accent',
        isActive
          ? 'bg-primary/10 text-primary'
          : 'text-muted-foreground'
      )}
    >
      <NavIcon className="h-5 w-5 shrink-0" />
      {!collapsed && (
        <>
          <span className="flex-1">{item.title}</span>
          {item.badge && (
            <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">
              {item.badge}
            </span>
          )}
        </>
      )}
    </ElectronLink>
  );
});

// Memoized nav item with tooltip
const NavItemWithTooltip = memo(function NavItemWithTooltip({
  item,
  isActive,
  collapsed,
}: {
  item: NavItem;
  isActive: boolean;
  collapsed: boolean;
}) {
  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div>
            <NavLink item={item} isActive={isActive} collapsed={collapsed} />
          </div>
        </TooltipTrigger>
        <TooltipContent side="right" className="flex items-center gap-2">
          {item.title}
          {item.badge && (
            <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
              {item.badge}
            </span>
          )}
        </TooltipContent>
      </Tooltip>
    );
  }

  return <NavLink item={item} isActive={isActive} collapsed={collapsed} />;
});

function SidebarComponent({ collapsed = false, onToggle }: SidebarProps) {
  const pathname = usePathname();

  // Memoize active states to prevent recalculation
  const activeStates = useMemo(() => {
    return navItems.map(item => ({
      ...item,
      isActive: pathname === item.href || 
        (item.href !== '/' && pathname.startsWith(item.href)),
    }));
  }, [pathname]);

  return (
    <TooltipProvider delayDuration={100}>
      <aside
        className={cn(
          'fixed left-0 top-0 z-40 flex h-screen flex-col border-r bg-card',
          collapsed ? 'w-16' : 'w-64'
        )}
      >
        {/* Logo Header */}
        <div className="flex h-16 items-center border-b px-4">
          <ElectronLink href="/" className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
              <Zap className="h-5 w-5 text-primary-foreground" />
            </div>
            {!collapsed && (
              <div className="flex flex-col">
                <span className="text-sm font-bold gradient-text">RPA Agent</span>
                <span className="text-[10px] text-muted-foreground">Enterprise v1.0</span>
              </div>
            )}
          </ElectronLink>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 p-2 overflow-y-auto">
          {activeStates.map((item) => (
            <NavItemWithTooltip
              key={item.href}
              item={item}
              isActive={item.isActive}
              collapsed={collapsed}
            />
          ))}
        </nav>

        {/* Collapse Toggle */}
        <div className="border-t p-2">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-center"
            onClick={onToggle}
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <>
                <ChevronLeft className="h-4 w-4 mr-2" />
                <span>Collapse</span>
              </>
            )}
          </Button>
        </div>
      </aside>
    </TooltipProvider>
  );
}

export const Sidebar = memo(SidebarComponent);
