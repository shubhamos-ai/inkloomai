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
    <aside className="hidden lg:flex flex-col fixed left-0 top-0 h-screen w-64 bg-[#121212] border-r border-white/10 z-40 select-none">
      {/* Brand Header */}
      <div className="flex items-center gap-3 px-6 py-6 border-b border-white/10">
        <div className="w-9 h-9 rounded bg-[#E50914] flex items-center justify-center flex-shrink-0 shadow-lg shadow-red-950/50">
          <ShieldCheck size={20} className="text-white" />
        </div>
        <div className="flex flex-col">
          <span className="text-white font-extrabold text-base tracking-tight leading-none uppercase">
            Inkloom<span className="text-[#E50914] ml-0.5">AI</span>
          </span>
          <span className="text-[10px] text-neutral-400 font-medium tracking-widest uppercase mt-1">
            Enterprise Ad Guard
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto">
        <p className="px-3 pb-2 text-[11px] font-bold text-neutral-500 uppercase tracking-wider">
          Platform Menu
        </p>
        {navItems.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3.5 py-3 rounded-lg text-sm font-medium transition-all duration-150 group ${
                active
                  ? 'bg-[#222222] text-white border-l-4 border-[#E50914] shadow-sm'
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
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[#E50914] shadow-sm shadow-red-500" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* User Profile Card */}
      <div className="px-4 py-4 border-t border-white/10 bg-[#0d0d0d]">
        <div className="rounded-lg bg-[#181818] border border-white/10 p-3">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-neutral-800 border border-white/10 flex items-center justify-center flex-shrink-0">
              <User size={15} className="text-neutral-300" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate leading-tight">
                {session?.fullName ?? 'Shubham Admin'}
              </p>
              <p className="text-xs text-neutral-400 truncate leading-tight mt-0.5">
                {session?.companyName ?? 'Enterprise Workspace'}
              </p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center justify-center gap-2 w-full px-3 py-2 text-xs font-semibold text-neutral-400 hover:text-white hover:bg-[#252525] rounded transition-all duration-150 group border border-transparent hover:border-white/10"
          >
            <LogOut size={14} className="text-neutral-500 group-hover:text-red-400 transition-colors" />
            Sign out
          </button>
        </div>
      </div>
    </aside>
  );
}
