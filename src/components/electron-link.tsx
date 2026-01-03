'use client';

import * as React from 'react';
import { isElectron } from '@/lib/ipc-client';

interface ElectronLinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
  children: React.ReactNode;
}

/**
 * Custom Link component that works with Electron's app:// protocol.
 * Uses the custom protocol for navigation in production Electron builds.
 */
export function ElectronLink({ href, children, onClick, ...props }: ElectronLinkProps) {
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (onClick) {
      onClick(e);
    }

    // In Electron, use app:// protocol for navigation
    if (isElectron() && !e.defaultPrevented) {
      e.preventDefault();
      
      // Build the correct path for app:// protocol
      let targetPath: string;
      if (href === '/') {
        targetPath = 'app://./index.html';
      } else {
        // Remove leading slash
        const cleanHref = href.startsWith('/') ? href.substring(1) : href;
        targetPath = `app://./${cleanHref}/index.html`;
      }
      
      window.location.href = targetPath;
    }
  };

  // For non-Electron environments, use normal link behavior
  const finalHref = isElectron() ? '#' : href;

  return (
    <a href={finalHref} onClick={handleClick} {...props}>
      {children}
    </a>
  );
}

