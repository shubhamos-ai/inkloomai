'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  User,
  Building2,
  Brain,
  ShieldCheck,
  LogOut,
  Save,
  CheckCircle2,
  Server,
  Globe,
  Radio,
  ExternalLink,
} from 'lucide-react';
import { getUserSession, saveUserSession, clearUserSession } from '@/lib/session';
import { validateFullName, validateCompanyName, validateWebsite } from '@/lib/validation';
import { getBrandBrain, checkApiHealth, getApiConfig, toggleMockMode } from '@/lib/api';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { ToastContainer, useToast } from '@/components/ui/Toast';

export default function SettingsContent() {
  const router = useRouter();
  const { toasts, dismissToast, success, error, info } = useToast();

  const [sessionData, setSessionData] = useState<{
    fullName: string;
    companyName: string;
    industry?: string;
    website?: string;
  }>({
    fullName: '',
    companyName: '',
    industry: '',
    website: '',
  });

  const [personalErrors, setPersonalErrors] = useState<string | null>(null);
  const [companyErrors, setCompanyErrors] = useState<{ name?: string; website?: string }>({});
  const [isSavingPersonal, setIsSavingPersonal] = useState(false);
  const [isSavingCompany, setIsSavingCompany] = useState(false);

  // Brand Brain summary state
  const [ruleCount, setRuleCount] = useState<number>(0);
  const [brandBrainVersion, setBrandBrainVersion] = useState<string>('1.0.0');

  // Backend connection status
  const [backendHealth, setBackendHealth] = useState<'checking' | 'online' | 'offline'>('checking');
  const [isMockMode, setIsMockMode] = useState<boolean>(false);
  const [apiEndpoint, setApiEndpoint] = useState<string>('');

  // Logout modal
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  useEffect(() => {
    const session = getUserSession();
    if (session) {
      setSessionData({
        fullName: session.fullName || '',
        companyName: session.companyName || '',
        industry: session.industry || '',
        website: session.website || '',
      });
    }

    // Load Brand Brain info
    getBrandBrain().then((brain) => {
      if (brain) {
        setRuleCount(brain.totalRules);
        setBrandBrainVersion(brain.version);
      }
    });

    // Check backend health & config
    const config = getApiConfig();
    setApiEndpoint(config.baseUrl);
    setIsMockMode(config.isMock);

    checkApiHealth().then((isHealthy) => {
      setBackendHealth(isHealthy ? 'online' : 'offline');
    });
  }, []);

  const handleSavePersonal = (e: React.FormEvent) => {
    e.preventDefault();
    const err = validateFullName(sessionData.fullName);
    if (err) {
      setPersonalErrors(err);
      return;
    }
    setPersonalErrors(null);
    setIsSavingPersonal(true);

    try {
      saveUserSession(sessionData);
      success('Personal information updated successfully.');
    } catch {
      error('Failed to update personal information.');
    } finally {
      setIsSavingPersonal(false);
    }
  };

  const handleSaveCompany = (e: React.FormEvent) => {
    e.preventDefault();
    const nameErr = validateCompanyName(sessionData.companyName);
    const webErr = sessionData.website ? validateWebsite(sessionData.website) : null;

    if (nameErr || webErr) {
      setCompanyErrors({
        name: nameErr || undefined,
        website: webErr || undefined,
      });
      return;
    }
    setCompanyErrors({});
    setIsSavingCompany(true);

    try {
      saveUserSession(sessionData);
      success('Company details updated successfully.');
    } catch {
      error('Failed to update company details.');
    } finally {
      setIsSavingCompany(false);
    }
  };

  const handleToggleMock = () => {
    const newMockState = toggleMockMode();
    setIsMockMode(newMockState);
    if (newMockState) {
      info('Switched to Mock Mode for testing without external backend.');
    } else {
      info('Switched to Real Backend Mode.');
      checkApiHealth().then((isHealthy) => {
        setBackendHealth(isHealthy ? 'online' : 'offline');
      });
    }
  };

  const handleLogout = () => {
    clearUserSession();
    router.replace('/onboarding');
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      <div>
        <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">Settings</h1>
        <p className="text-sm text-neutral-500 mt-1">
          Manage your profile, company details, AI backend, and workspace.
        </p>
      </div>

      {/* Backend & AI Integration Status Card */}
      <div className="bg-white rounded-2xl border border-[#E8E2D9] shadow-sm p-5">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: '#E50914' }}
            >
              <Server className="w-5 h-5 text-neutral-900" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-neutral-900 text-base">AI Backend</h3>
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                    backendHealth === 'online'
                      ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                      : backendHealth === 'checking'
                      ? 'bg-white/10 text-neutral-400 border-white/20'
                      : 'bg-orange-500/15 text-orange-400 border-orange-500/30'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      backendHealth === 'online'
                        ? 'bg-emerald-500 animate-pulse'
                        : backendHealth === 'checking'
                        ? 'bg-neutral-500'
                        : 'bg-orange-500'
                    }`}
                  />
                  {backendHealth === 'online'
                    ? 'Connected — Inkloom AI Engine'
                    : backendHealth === 'checking'
                    ? 'Checking…'
                    : 'Offline / Unreachable'}
                </span>
              </div>
              <p className="text-xs text-neutral-500 mt-1 font-mono break-all">
                {apiEndpoint}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleToggleMock}
              className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-all ${
                isMockMode
                  ? 'bg-orange-500/15 text-orange-400 border-orange-500/30 hover:bg-orange-500/25'
                  : 'bg-[#FAF8F5] text-neutral-300 border-white/20 hover:bg-white/10'
              }`}
            >
              {isMockMode ? 'Mode: Mock Data' : 'Mode: Real Backend'}
            </button>
            <button
              onClick={async () => {
                setBackendHealth('checking');
                const healthy = await checkApiHealth();
                setBackendHealth(healthy ? 'online' : 'offline');
                if (healthy) success('AI Backend responded OK (/api/v1/health)');
                else error('Backend did not respond. Check your NEXT_PUBLIC_AI_API_URL.');
              }}
              className="text-xs px-3 py-1.5 rounded-lg border border-white/20 bg-[#FAF8F5] text-neutral-900 font-medium hover:bg-white/10 transition-all"
            >
              Test Ping
            </button>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-[#F0EBE1] grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-neutral-500">
          <div>
            <span className="font-medium text-neutral-400">Vision Model:</span>{' '}
            Inkloom Vision v1 (Multimodal)
          </div>
          <div>
            <span className="font-medium text-neutral-400">Deployment:</span>{' '}
            Cloud Service
          </div>
        </div>
      </div>

      {/* Personal Info */}
      <div className="bg-white rounded-2xl border border-[#E8E2D9] shadow-sm p-5">
        <div className="flex items-center gap-3 mb-5 pb-4 border-b border-[#F0EBE1]">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'rgba(229,9,20,0.2)' }}>
            <User className="w-4 h-4" style={{ color: '#E50914' }} />
          </div>
          <div>
            <h2 className="text-base font-semibold text-neutral-900">Personal Information</h2>
            <p className="text-xs text-neutral-500">Your profile details within the workspace.</p>
          </div>
        </div>

        <form onSubmit={handleSavePersonal} className="space-y-4 max-w-lg">
          <div>
            <label className="block text-xs font-medium text-neutral-400 mb-1.5">Full Name</label>
            <input
              type="text"
              value={sessionData.fullName}
              onChange={(e) => setSessionData({ ...sessionData, fullName: e.target.value })}
              className={`w-full px-4 py-3 rounded-lg border bg-[#FAF8F5] text-neutral-900 placeholder-neutral-500 outline-none focus:ring-2 focus:ring-[#E50914] focus:border-transparent transition-all text-sm ${personalErrors ? 'border-red-500/50' : 'border-white/15'}`}
              placeholder="e.g. Alex Morgan"
            />
            {personalErrors && <p className="text-xs text-red-400 mt-1">{personalErrors}</p>}
          </div>

          <button
            type="submit"
            disabled={isSavingPersonal}
            className="inline-flex items-center gap-2 text-sm font-semibold text-white rounded-xl px-5 py-2.5 transition-all hover:brightness-110 active:scale-95"
            style={{ backgroundColor: '#E50914' }}
          >
            <Save className="w-4 h-4" />
            {isSavingPersonal ? 'Saving…' : 'Save Personal Details'}
          </button>
        </form>
      </div>

      {/* Company Info */}
      <div className="bg-white rounded-2xl border border-[#E8E2D9] shadow-sm p-5">
        <div className="flex items-center gap-3 mb-5 pb-4 border-b border-[#F0EBE1]">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'rgba(229,9,20,0.2)' }}>
            <Building2 className="w-4 h-4" style={{ color: '#E50914' }} />
          </div>
          <div>
            <h2 className="text-base font-semibold text-neutral-900">Company Information</h2>
            <p className="text-xs text-neutral-500">Organisation branding profile used during AI analysis.</p>
          </div>
        </div>

        <form onSubmit={handleSaveCompany} className="space-y-4 max-w-lg">
          <div>
            <label className="block text-xs font-medium text-neutral-400 mb-1.5">Company Name</label>
            <input
              type="text"
              value={sessionData.companyName}
              onChange={(e) => setSessionData({ ...sessionData, companyName: e.target.value })}
              className={`w-full px-4 py-3 rounded-lg border bg-[#FAF8F5] text-neutral-900 placeholder-neutral-500 outline-none focus:ring-2 focus:ring-[#E50914] focus:border-transparent transition-all text-sm ${companyErrors.name ? 'border-red-500/50' : 'border-white/15'}`}
              placeholder="e.g. Acme Corporation"
            />
            {companyErrors.name && <p className="text-xs text-red-400 mt-1">{companyErrors.name}</p>}
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-400 mb-1.5">Industry (Optional)</label>
            <input
              type="text"
              value={sessionData.industry || ''}
              onChange={(e) => setSessionData({ ...sessionData, industry: e.target.value })}
              className="w-full px-4 py-3 rounded-lg border border-white/15 bg-[#FAF8F5] text-neutral-900 placeholder-neutral-500 outline-none focus:ring-2 focus:ring-[#E50914] focus:border-transparent transition-all text-sm"
              placeholder="e.g. Technology, Retail, Healthcare"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-400 mb-1.5">Company Website (Optional)</label>
            <input
              type="text"
              value={sessionData.website || ''}
              onChange={(e) => setSessionData({ ...sessionData, website: e.target.value })}
              className={`w-full px-4 py-3 rounded-lg border bg-[#FAF8F5] text-neutral-900 placeholder-neutral-500 outline-none focus:ring-2 focus:ring-[#E50914] focus:border-transparent transition-all text-sm ${companyErrors.website ? 'border-red-500/50' : 'border-white/15'}`}
              placeholder="https://example.com"
            />
            {companyErrors.website && <p className="text-xs text-red-400 mt-1">{companyErrors.website}</p>}
          </div>

          <button
            type="submit"
            disabled={isSavingCompany}
            className="inline-flex items-center gap-2 text-sm font-semibold text-white rounded-xl px-5 py-2.5 transition-all hover:brightness-110 active:scale-95"
            style={{ backgroundColor: '#E50914' }}
          >
            <Save className="w-4 h-4" />
            {isSavingCompany ? 'Saving…' : 'Save Company Details'}
          </button>
        </form>
      </div>

      {/* Brand Brain Summary */}
      <div className="bg-white rounded-2xl border border-[#E8E2D9] shadow-sm p-5">
        <div className="flex items-center justify-between pb-4 border-b border-[#F0EBE1]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'rgba(229,9,20,0.2)' }}>
              <Brain className="w-4 h-4" style={{ color: '#E50914' }} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-neutral-900">Brand Brain</h2>
              <p className="text-xs text-neutral-500">Active rules engine and governance policies.</p>
            </div>
          </div>
          <button
            onClick={() => router.push('/brand-brain')}
            className="flex items-center gap-1.5 text-xs font-medium text-neutral-400 hover:text-neutral-900 border border-white/20 rounded-lg px-3 py-2 hover:bg-[#FAF8F5] transition-all"
          >
            Manage Rules
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="bg-[#FAF8F5] rounded-lg p-3 text-center border border-[#F0EBE1]">
            <span className="text-xs text-neutral-500 block">Active Rules</span>
            <span className="text-xl font-bold text-neutral-900 mt-1 block">{ruleCount}</span>
          </div>
          <div className="bg-[#FAF8F5] rounded-lg p-3 text-center border border-[#F0EBE1]">
            <span className="text-xs text-neutral-500 block">Version</span>
            <span className="text-xl font-bold text-neutral-900 mt-1 block">v{brandBrainVersion}</span>
          </div>
          <div className="bg-[#FAF8F5] rounded-lg p-3 text-center col-span-2 sm:col-span-1 border border-[#F0EBE1]">
            <span className="text-xs text-neutral-500 block">Status</span>
            <span className="text-sm font-semibold text-emerald-400 mt-1.5 inline-flex items-center gap-1">
              <CheckCircle2 className="w-4 h-4" /> Active
            </span>
          </div>
        </div>
      </div>

      {/* Session & Sign Out */}
      <div className="bg-black/40 rounded-xl border border-red-200 p-5">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-base font-semibold text-neutral-900">Sign Out</h2>
            <p className="text-xs text-neutral-500 mt-0.5">
              Clears your local session. You can sign back in anytime.
            </p>
          </div>
          <button
            onClick={() => setShowLogoutConfirm(true)}
            className="inline-flex items-center gap-2 text-sm font-medium text-red-400 border border-red-500/30 rounded-lg px-4 py-2.5 hover:bg-red-500/15 transition-all"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </div>

      {/* About */}
      <div className="text-center text-xs text-neutral-600 py-4">
        <p className="font-semibold text-neutral-500">Inkloom AI v1.0.0</p>
        <p className="mt-1">Advertising Compliance &amp; Brand Governance — Powered by Inkloom AI Model</p>
      </div>

      {/* Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showLogoutConfirm}
        title="Sign Out of Inkloom AI?"
        message="Are you sure you want to sign out? Your session data will be cleared and you will be returned to the onboarding screen."
        confirmLabel="Yes, Sign Out"
        cancelLabel="Stay in Workspace"
        variant="danger"
        onConfirm={handleLogout}
        onCancel={() => setShowLogoutConfirm(false)}
      />
    </div>
  );
}
