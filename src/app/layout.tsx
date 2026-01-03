'use client';

import React, { useState, useCallback, useMemo } from 'react';
import './globals.css';
import { Sidebar } from '@/components/layout/sidebar';
import { TopNav } from '@/components/layout/top-nav';
import { Toaster } from '@/components/ui/toaster';
import { cn } from '@/lib/utils';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const handleToggle = useCallback(() => {
    setSidebarCollapsed(prev => !prev);
  }, []);

  const mainClassName = useMemo(() => cn(
    'min-h-screen pt-16',
    sidebarCollapsed ? 'pl-16' : 'pl-64'
  ), [sidebarCollapsed]);

  return (
    <html lang="en" className="dark">
      <head>
        <title>Enterprise RPA Agent</title>
        <meta name="description" content="Enterprise Browser Automation Platform" />
      </head>
      <body 
        className="min-h-screen bg-background antialiased"
        style={{ 
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        }}
      >
        <Sidebar collapsed={sidebarCollapsed} onToggle={handleToggle} />
        <TopNav sidebarCollapsed={sidebarCollapsed} />
        <main className={mainClassName}>
          <div className="container mx-auto p-6">
            {children}
          </div>
        </main>
        <Toaster />
      </body>
    </html>
  );
}
