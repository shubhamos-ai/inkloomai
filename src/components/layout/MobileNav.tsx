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
  ShieldCheck,
} from 'lucide-react';
import { getUserSession, clearUserSession } from '@/lib/session';

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  { label: 'Overview', href: '/dashboard', icon: <LayoutDashboard size={18} /> },
  { label: 'Analyse Advertisement', href: '/analysis', icon: <ScanLine size={18} /> },
  { label: 'Analysis History', href: '/history', icon: <History size={18} /> },
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
      <header className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-[#121212] border-b border-white/10 h-14 flex items-center justify-between px-4">
        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded bg-[#E50914] flex items-center justify-center">
            <ShieldCheck size={16} className="text-white" />
          </div>
          <span className="text-white font-extrabold text-sm tracking-tight uppercase">
            Inkloom<span className="text-[#E50914]">AI</span>
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
            className="lg:hidden fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
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
            className="lg:hidden fixed left-0 top-0 h-screen w-72 bg-[#121212] border-r border-white/10 z-[60] flex flex-col shadow-2xl"
          >
            {/* Drawer Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded bg-[#E50914] flex items-center justify-center">
                  <ShieldCheck size={18} className="text-white" />
                </div>
                <span className="text-white font-extrabold text-[15px] tracking-tight uppercase">
                  Inkloom<span className="text-[#E50914]">AI</span>
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
            <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
              <p className="px-3 pb-2 text-[11px] font-bold text-neutral-500 uppercase tracking-wider">
                Platform Menu
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
                        ? 'bg-[#222222] text-white border-l-4 border-[#E50914]'
                        : 'text-neutral-400 hover:bg-[#1a1a1a] hover:text-white'
                    }`}
                  >
                    <span
                      className={`flex-shrink-0 transition-colors duration-150 ${
                        active ? 'text-[#E50914]' : 'text-neutral-500 group-hover:text-neutral-300'
                      }`}
                    >
                      {item.icon}
                    </span>
                    <span className="truncate">{item.label}</span>
                    {active && (
                      <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[#E50914]" />
                    )}
                  </Link>
                );
              })}
            </nav>

            {/* User Profile */}
            <div className="px-3 py-4 border-t border-white/10 bg-[#0d0d0d]">
              <div className="rounded-lg bg-[#181818] border border-white/10 p-3">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded-full bg-neutral-800 border border-white/10 flex items-center justify-center flex-shrink-0">
                    <User size={16} className="text-neutral-300" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate leading-tight">
                      {session?.fullName ?? 'User'}
                    </p>
                    <p className="text-xs text-neutral-400 truncate leading-tight mt-0.5">
                      {session?.companyName ?? 'Company'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  className="flex items-center justify-center gap-2 w-full px-3 py-2 text-xs font-semibold text-neutral-400 hover:text-white hover:bg-[#252525] rounded transition-all duration-150 group"
                >
                  <LogOut size={14} className="text-neutral-500 group-hover:text-red-400 transition-colors" />
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
