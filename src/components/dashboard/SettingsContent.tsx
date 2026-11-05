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
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in pb-12">
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      <div>
        <h1 className="text-2xl font-bold text-slate-900">Workspace Settings</h1>
        <p className="text-sm text-slate-500 mt-1">
          Manage your personal profile, company details, AI backend integration, and workspace preferences.
        </p>
      </div>

      {/* Backend & AI Integration Status Card */}
      <div className="card p-6 border-blue-100 bg-gradient-to-r from-blue-50/40 via-white to-white">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-slate-900 text-base">External AI Backend Integration</h3>
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                    backendHealth === 'online'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : backendHealth === 'checking'
                      ? 'bg-slate-100 text-slate-600 border border-slate-200'
                      : 'bg-amber-50 text-amber-700 border border-amber-200'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      backendHealth === 'online'
                        ? 'bg-emerald-500 animate-pulse'
                        : backendHealth === 'checking'
                        ? 'bg-slate-400'
                        : 'bg-amber-500'
                    }`}
                  />
                  {backendHealth === 'online'
                    ? 'Connected (FastAPI + Ollama)'
                    : backendHealth === 'checking'
                    ? 'Checking connection...'
                    : 'Backend Standby / Unreachable'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1 font-mono">
                Endpoint: <span className="text-blue-700">{apiEndpoint}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleToggleMock}
              className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-all ${
                isMockMode
                  ? 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              Mode: {isMockMode ? 'Mock Data (Active)' : 'Real Backend (Active)'}
            </button>
            <button
              onClick={async () => {
                setBackendHealth('checking');
                const healthy = await checkApiHealth();
                setBackendHealth(healthy ? 'online' : 'offline');
                if (healthy) success('AI Backend responded OK (/api/v1/health)');
                else error('Backend did not respond. Check tunnel or CORS.');
              }}
              className="text-xs px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 font-medium hover:bg-blue-100"
            >
              Test Ping
            </button>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-600">
          <div>
            <span className="font-semibold text-slate-700">Production Frontend:</span>{' '}
            <span className="text-slate-500">https://inkoom-ai.shubhamos.com</span>
          </div>
          <div>
            <span className="font-semibold text-slate-700">Cloudflare Tunnel:</span>{' '}
            <span className="text-slate-500">https://inkoom-model.shubhamos.com</span>
          </div>
        </div>
      </div>

      {/* Personal Info */}
      <div className="card p-6">
        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
          <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
            <User className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-900">Personal Information</h2>
            <p className="text-xs text-slate-500">Your profile details within the workspace.</p>
          </div>
        </div>

        <form onSubmit={handleSavePersonal} className="space-y-4 max-w-lg">
          <div>
            <label className="label">Full Name</label>
            <input
              type="text"
              value={sessionData.fullName}
              onChange={(e) => setSessionData({ ...sessionData, fullName: e.target.value })}
              className={`input-field ${personalErrors ? 'border-red-300 ring-1 ring-red-300' : ''}`}
              placeholder="e.g. Alex Morgan"
            />
            {personalErrors && <p className="text-xs text-red-600 mt-1">{personalErrors}</p>}
          </div>

          <button
            type="submit"
            disabled={isSavingPersonal}
            className="btn-primary inline-flex items-center gap-2 text-sm py-2.5 px-4"
          >
            <Save className="w-4 h-4" />
            {isSavingPersonal ? 'Saving...' : 'Save Personal Details'}
          </button>
        </form>
      </div>

      {/* Company Info */}
      <div className="card p-6">
        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
          <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
            <Building2 className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-900">Company Information</h2>
            <p className="text-xs text-slate-500">Organisation branding profile used during AI analysis.</p>
          </div>
        </div>

        <form onSubmit={handleSaveCompany} className="space-y-4 max-w-lg">
          <div>
            <label className="label">Company Name</label>
            <input
              type="text"
              value={sessionData.companyName}
              onChange={(e) => setSessionData({ ...sessionData, companyName: e.target.value })}
              className={`input-field ${companyErrors.name ? 'border-red-300 ring-1 ring-red-300' : ''}`}
              placeholder="e.g. Acme Corporation"
            />
            {companyErrors.name && <p className="text-xs text-red-600 mt-1">{companyErrors.name}</p>}
          </div>

          <div>
            <label className="label">Industry (Optional)</label>
            <input
              type="text"
              value={sessionData.industry || ''}
              onChange={(e) => setSessionData({ ...sessionData, industry: e.target.value })}
              className="input-field"
              placeholder="e.g. Technology, Retail, Healthcare"
            />
          </div>

          <div>
            <label className="label">Company Website (Optional)</label>
            <input
              type="text"
              value={sessionData.website || ''}
              onChange={(e) => setSessionData({ ...sessionData, website: e.target.value })}
              className={`input-field ${companyErrors.website ? 'border-red-300 ring-1 ring-red-300' : ''}`}
              placeholder="https://example.com"
            />
            {companyErrors.website && <p className="text-xs text-red-600 mt-1">{companyErrors.website}</p>}
          </div>

          <button
            type="submit"
            disabled={isSavingCompany}
            className="btn-primary inline-flex items-center gap-2 text-sm py-2.5 px-4"
          >
            <Save className="w-4 h-4" />
            {isSavingCompany ? 'Saving...' : 'Save Company Details'}
          </button>
        </form>
      </div>

      {/* Brand Brain Summary */}
      <div className="card p-6">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Brain className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">Brand Brain Knowledge</h2>
              <p className="text-xs text-slate-500">Active rules engine and governance policies.</p>
            </div>
          </div>
          <button
            onClick={() => router.push('/brand-brain')}
            className="btn-secondary text-xs py-2 px-3 flex items-center gap-1.5"
          >
            Manage Rules
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div className="bg-slate-50 rounded-xl p-3 text-center">
            <span className="text-xs text-slate-500 block">Total Active Rules</span>
            <span className="text-xl font-bold text-slate-900 mt-1 block">{ruleCount}</span>
          </div>
          <div className="bg-slate-50 rounded-xl p-3 text-center">
            <span className="text-xs text-slate-500 block">Rules Version</span>
            <span className="text-xl font-bold text-slate-900 mt-1 block">v{brandBrainVersion}</span>
          </div>
          <div className="bg-slate-50 rounded-xl p-3 text-center col-span-2 sm:col-span-1">
            <span className="text-xs text-slate-500 block">Governance Status</span>
            <span className="text-sm font-semibold text-emerald-600 mt-1.5 inline-flex items-center gap-1">
              <CheckCircle2 className="w-4 h-4" /> Active
            </span>
          </div>
        </div>
      </div>

      {/* Session & Sign Out */}
      <div className="card p-6 border-red-100">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Sign Out of Workspace</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Clears your local session data. You can re-enter your credentials anytime.
            </p>
          </div>
          <button
            onClick={() => setShowLogoutConfirm(true)}
            className="btn-danger inline-flex items-center gap-2 text-sm py-2.5 px-4"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </div>

      {/* About */}
      <div className="text-center text-xs text-slate-400 py-4">
        <p className="font-semibold text-slate-500">Inkloom AI (Inkoom AI) v1.0.0</p>
        <p className="mt-1">
          Automated Advertising Compliance and Brand Governance Platform
        </p>
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
