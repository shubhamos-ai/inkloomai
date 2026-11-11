'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  ScanLine,
  History,
  Brain,
  Settings,
  LogOut,
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

interface SidebarProps {
  currentPath: string;
}

export default function Sidebar({ currentPath }: SidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const session = getUserSession();

  const activePath = pathname ?? currentPath;

  const isActive = (href: string): boolean => {
    return activePath === href || activePath.startsWith(href + '/');
  };

  const handleLogout = async () => {
    // Invalidate the server-side session and clear HttpOnly cookies; local
    // state is cleared even if the backend is unreachable.
    try { await logoutAccount(); } catch { /* best-effort */ }
    clearUserSession();
    router.push('/onboarding');
  };

  return (
    <aside className="hidden lg:flex flex-col fixed left-0 top-0 h-screen w-60 bg-[#FAF8F5]/90 backdrop-blur-xl border-r border-[#E8E2D9] z-40 shadow-[1px_0_16px_rgba(0,0,0,0.02)]">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-[#E8E2D9]">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center shadow-sm shadow-red-500/20"
          style={{ backgroundColor: '#E50914' }}
        >
          <span className="text-white text-xs font-bold tracking-tight">IN</span>
        </div>
        <div>
          <span
            className="text-lg font-black tracking-tight flex items-center gap-1.5"
            style={{ color: '#E50914' }}
          >
            INKLOOM
            <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-red-100 text-red-700">
              AI
            </span>
          </span>
        </div>
      </div>

      {/* Navigation */}
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
                <span className="ml-auto w-1.5 h-4 rounded-full" style={{ backgroundColor: '#E50914' }} />
              )}
            </Link>
          );
        })}
      </nav>

      {/* User Profile Card */}
      <div className="px-3 py-4 border-t border-[#E8E2D9]">
        <div className="rounded-xl bg-white border border-[#E8E2D9] p-3 shadow-sm">
          <div className="flex items-center gap-3 mb-2.5">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
              style={{ backgroundColor: 'rgba(229,9,20,0.1)' }}
            >
              <User size={15} style={{ color: '#E50914' }} />
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
    </aside>
  );
}