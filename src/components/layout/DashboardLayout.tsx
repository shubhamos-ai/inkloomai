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
    <div className="min-h-screen bg-[#141414]">
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
        ].join(' ')}
      >
        <div className="px-4 py-6 sm:px-6 lg:px-8 lg:py-8 max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}