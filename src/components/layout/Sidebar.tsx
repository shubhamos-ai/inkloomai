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

  const handleLogout = () => {
    clearUserSession();
    router.push('/onboarding');
  };

  return (
    <aside className="hidden lg:flex flex-col fixed left-0 top-0 h-screen w-56 bg-black/80 backdrop-blur-xl border-r border-white/10 z-40">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-white/10">
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

      {/* Navigation */}
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
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group ${
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
                <span className="ml-auto w-1 h-4 rounded-full" style={{ backgroundColor: '#E50914' }} />
              )}
            </Link>
          );
        })}
      </nav>

      {/* User Profile Card */}
      <div className="px-3 py-4 border-t border-white/10">
        <div className="rounded-xl bg-white/5 border border-white/10 p-3">
          <div className="flex items-center gap-3 mb-3">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center"
              style={{ backgroundColor: 'rgba(229,9,20,0.2)' }}
            >
              <User size={15} style={{ color: '#E50914' }} />
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
    </aside>
  );
}