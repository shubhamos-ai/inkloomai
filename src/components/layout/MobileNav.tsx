'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  ScanLine,
  History,
  Brain,
  Settings,
  LogOut,
  Menu,
  X,
  User,
} from 'lucide-react';
import { getUserSession, clearUserSession } from '@/lib/session';
import { logoutAccount } from '@/lib/api';

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  { label: 'Overview', href: '/dashboard', icon: <LayoutDashboard size={18} /> },
  { label: 'Analyse', href: '/analysis', icon: <ScanLine size={18} /> },
  { label: 'History', href: '/history', icon: <History size={18} /> },
  { label: 'Brand Brain', href: '/brand-brain', icon: <Brain size={18} /> },
  { label: 'Settings', href: '/settings', icon: <Settings size={18} /> },
];

interface MobileNavProps {
  currentPath: string;
}

export default function MobileNav({ currentPath }: MobileNavProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  // Read localStorage after mount to keep the first client render identical
  // to the prerendered HTML.
  const [session, setSession] = useState<ReturnType<typeof getUserSession>>(null);

  useEffect(() => {
    setSession(getUserSession());
  }, []);

  const activePath = pathname ?? currentPath;

  const isActive = (href: string): boolean => {
    return activePath === href || activePath.startsWith(href + '/');
  };

  const handleLogout = async () => {
    setDrawerOpen(false);
    try { await logoutAccount(); } catch { /* best-effort */ }
    clearUserSession();
    router.push('/onboarding');
  };

  const closeDrawer = () => setDrawerOpen(false);

  return (
    <>
      {/* Top Header Bar */}
      <header
        className="lg:hidden fixed top-0 left-0 right-0 z-50 h-14 flex items-center justify-between px-4 bg-[#FAF8F5]/90 backdrop-blur-md border-b border-[#E8E2D9]"
      >
        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center shadow-sm"
            style={{ backgroundColor: '#E50914' }}
          >
            <span className="text-white text-[11px] font-bold tracking-tight">IN</span>
          </div>
          <span
            className="text-lg font-black tracking-tight"
            style={{ color: '#E50914' }}
          >
            INKLOOM
          </span>
        </div>

        {/* Hamburger */}
        <button
          onClick={() => setDrawerOpen(true)}
          className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-[#F3EFEA] transition-colors"
          aria-label="Open menu"
        >
          <Menu size={20} className="text-neutral-800" />
        </button>
      </header>

      {/* Backdrop */}
      <AnimatePresence>
        {drawerOpen && (
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="lg:hidden fixed inset-0 z-50 bg-black/30 backdrop-blur-sm"
            onClick={closeDrawer}
          />
        )}
      </AnimatePresence>

      {/* Slide-out Drawer */}
      <AnimatePresence>
        {drawerOpen && (
          <motion.aside
            key="drawer"
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="lg:hidden fixed left-0 top-0 h-screen w-72 z-[60] flex flex-col shadow-2xl bg-[#FAF8F5] border-r border-[#E8E2D9]"
          >
            {/* Drawer Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#E8E2D9]">
              <div className="flex items-center gap-2.5">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center shadow-sm"
                  style={{ backgroundColor: '#E50914' }}
                >
                  <span className="text-white text-xs font-bold tracking-tight">IN</span>
                </div>
                <span
                  className="text-lg font-black tracking-tight"
                  style={{ color: '#E50914' }}
                >
                  INKLOOM
                </span>
              </div>
              <button
                onClick={closeDrawer}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#F3EFEA] transition-colors"
                aria-label="Close menu"
              >
                <X size={18} className="text-neutral-500" />
              </button>
            </div>

            {/* Navigation Links */}
            <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto">
              <p className="px-3 pb-2 text-[10px] font-bold text-neutral-400 uppercase tracking-widest">
                Workspace
              </p>
              {navItems.map((item) => {
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={closeDrawer}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150 group ${
                      active
                        ? 'bg-white text-neutral-900 shadow-sm border border-[#E4DDD3]'
                        : 'text-neutral-600 hover:bg-[#F3EFEA] hover:text-neutral-900'
                    }`}
                  >
                    <span
                      className={`flex-shrink-0 transition-colors duration-150 ${
                        active ? 'text-[#E50914]' : 'text-neutral-400 group-hover:text-neutral-700'
                      }`}
                    >
                      {item.icon}
                    </span>
                    <span className="truncate">{item.label}</span>
                    {active && (
                      <span
                        className="ml-auto w-1.5 h-4 rounded-full"
                        style={{ backgroundColor: '#E50914' }}
                      />
                    )}
                  </Link>
                );
              })}
            </nav>

            {/* User Profile */}
            <div className="px-3 py-4 border-t border-[#E8E2D9]">
              <div
                className="rounded-xl border border-[#E8E2D9] p-3 bg-white shadow-sm"
              >
                <div className="flex items-center gap-3 mb-2.5">
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: 'rgba(229,9,20,0.1)' }}
                  >
                    <User size={16} style={{ color: '#E50914' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-neutral-900 truncate leading-tight">
                      {session?.fullName ?? 'User'}
                    </p>
                    <p className="text-[11px] text-neutral-500 truncate leading-tight mt-0.5">
                      {session?.companyName ?? 'Company Workspace'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  className="flex items-center justify-center gap-2 w-full px-3 py-1.5 text-xs font-medium text-neutral-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all duration-150 group"
                >
                  <LogOut size={13} className="text-neutral-400 group-hover:text-red-500 transition-colors" />
                  Sign out
                </button>
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
}