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
    <div className="min-h-screen bg-[#141414] text-neutral-100 selection:bg-[#E50914] selection:text-white">
      {/* Desktop Sidebar */}
      <Sidebar currentPath={currentPath} />

      {/* Mobile Navigation Header */}
      <MobileNav currentPath={currentPath} />

      {/* Main Content */}
      <main
        className={[
          // Desktop: offset for sidebar
          'lg:ml-64',
          // Mobile: offset for top nav bar
          'pt-14 lg:pt-0',
          // Padding
          'min-h-screen bg-[#141414]',
        ].join(' ')}
      >
        <div className="px-4 py-6 sm:px-6 lg:px-10 lg:py-8 max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
