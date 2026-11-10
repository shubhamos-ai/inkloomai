'use client';

import React from 'react';
import Sidebar from '@/components/layout/Sidebar';
import MobileNav from '@/components/layout/MobileNav';

interface DashboardLayoutProps {
  children: React.ReactNode;
  currentPath: string;
}

export default function DashboardLayout({ children, currentPath }: DashboardLayoutProps) {
  return (
    <div className="min-h-screen bg-[#FAF8F5] text-neutral-900 selection:bg-[#E50914]/15 selection:text-[#E50914]">
      {/* Subtle luxury ambient glow at top */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 h-64 opacity-40 z-0"
        style={{
          background: 'radial-gradient(50rem 20rem at 50% -10%, rgba(229, 9, 20, 0.08), transparent 70%)',
        }}
      />

      {/* Desktop Sidebar */}
      <Sidebar currentPath={currentPath} />

      {/* Mobile Navigation Header */}
      <MobileNav currentPath={currentPath} />

      {/* Main Content */}
      <main
        className={[
          'lg:ml-60',
          'pt-14 lg:pt-0',
          'min-h-screen',
          'relative z-10',
        ].join(' ')}
      >
        <div className="px-4 py-6 sm:px-6 lg:px-8 lg:py-8 max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}