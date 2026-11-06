'use client';

import React, { useState } from 'react';
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
  const session = getUserSession();

  const activePath = pathname ?? currentPath;

  const isActive = (href: string): boolean => {
    return activePath === href || activePath.startsWith(href + '/');
  };

  const handleLogout = () => {
    setDrawerOpen(false);
    clearUserSession();
    router.push('/onboarding');
  };

  const closeDrawer = () => setDrawerOpen(false);

  return (
    <>
      {/* Top Header Bar */}
      <header
        className="lg:hidden fixed top-0 left-0 right-0 z-50 h-14 flex items-center justify-between px-4"
        style={{ backgroundColor: 'rgba(20,20,20,0.9)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}
      >
        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: '#E50914' }}
          >
            <span className="text-white text-[11px] font-bold tracking-tight">IN</span>
          </div>
          <span
            className="text-lg font-extrabold tracking-tight"
            style={{ color: '#E50914', textShadow: '0 0 20px rgba(229,9,20,0.4)' }}
          >
            INKLOOM
          </span>
        </div>

        {/* Hamburger */}
        <button
          onClick={() => setDrawerOpen(true)}
          className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors"
          aria-label="Open menu"
        >
          <Menu size={20} className="text-white" />
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
            className="lg:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
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
            className="lg:hidden fixed left-0 top-0 h-screen w-72 z-[60] flex flex-col shadow-2xl"
            style={{ backgroundColor: '#141414', borderRight: '1px solid rgba(255,255,255,0.1)' }}
          >
            {/* Drawer Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: '#E50914' }}
                >
                  <span className="text-white text-xs font-bold tracking-tight">IN</span>
                </div>
                <span
                  className="text-lg font-extrabold tracking-tight"
                  style={{ color: '#E50914', textShadow: '0 0 20px rgba(229,9,20,0.4)' }}
                >
                  INKLOOM
                </span>
              </div>
              <button
                onClick={closeDrawer}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors"
                aria-label="Close menu"
              >
                <X size={18} className="text-neutral-400" />
              </button>
            </div>

            {/* Navigation Links */}
            <nav className="flex-1 px-3 py-5 space-y-0.5 overflow-y-auto">
              <p className="px-3 pb-2 text-[10px] font-semibold text-neutral-600 uppercase tracking-wider">
                Menu
              </p>
              {navItems.map((item) => {
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={closeDrawer}
                    className={`flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-all duration-150 group ${
                      active
                        ? 'bg-white/10 text-white'
                        : 'text-neutral-400 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <span
                      className={`flex-shrink-0 transition-colors duration-150 ${
                        active ? 'text-white' : 'text-neutral-500 group-hover:text-neutral-300'
                      }`}
                    >
                      {item.icon}
                    </span>
                    <span className="truncate">{item.label}</span>
                    {active && (
                      <span
                        className="ml-auto w-1 h-4 rounded-full"
                        style={{ backgroundColor: '#E50914' }}
                      />
                    )}
                  </Link>
                );
              })}
            </nav>

            {/* User Profile */}
            <div className="px-3 py-4 border-t border-white/10">
              <div
                className="rounded-xl border border-white/10 p-3"
                style={{ backgroundColor: 'rgba(255,255,255,0.03)' }}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: 'rgba(229,9,20,0.2)' }}
                  >
                    <User size={16} style={{ color: '#E50914' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate leading-tight">
                      {session?.fullName ?? 'User'}
                    </p>
                    <p className="text-xs text-neutral-500 truncate leading-tight mt-0.5">
                      {session?.companyName ?? 'Company'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-2 w-full px-3 py-2 text-xs font-medium text-neutral-400 hover:text-white hover:bg-white/5 rounded-lg transition-all duration-150 group"
                >
                  <LogOut size={14} className="text-neutral-500 group-hover:text-neutral-300 transition-colors" />
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