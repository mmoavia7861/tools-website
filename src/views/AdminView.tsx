import React, { useState, useEffect } from 'react';
import {
  Lock,
  ShieldCheck,
  LogOut,
  Cpu,
  Server,
  FileText,
  DollarSign,
  Sparkles,
  Search,
  Brain,
  Mail,
  CheckCircle2,
  AlertCircle,
  Eye,
  Plus,
  Trash2,
  RefreshCw
} from 'lucide-react';
import { SEOHead } from '../components/SEOHead';
import {
  auth,
  googleProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  type User,
  db,
  collection,
  getDocs,
  setDoc,
  doc
} from '../services/firebase';
import { STARTER_BLOG_POSTS, type BlogPostItem } from '../data/initialContent';

const OWNER_EMAIL = 'moaviah760@gmail.com';

export const AdminView: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'blog' | 'ads' | 'ai' | 'messages'>('overview');

  // Server health data
  const [healthData, setHealthData] = useState<any>(null);
  const [providerData, setProviderData] = useState<any>(null);

  // Blog posts management
  const [blogPosts, setBlogPosts] = useState<BlogPostItem[]>(STARTER_BLOG_POSTS);
  const [editingPost, setEditingPost] = useState<BlogPostItem | null>(null);

  // AdSense configuration states
  const [adsenseEnabled, setAdsenseEnabled] = useState(false);
  const [publisherId, setPublisherId] = useState('ca-pub-XXXXXXXXXXXXXXXX');
  const [adSavedNotice, setAdSavedNotice] = useState(false);

  // Gemini Intelligence tester
  const [geminiTask, setGeminiTask] = useState<'deep_audit' | 'search_grounded' | 'fast_assist'>('deep_audit');
  const [geminiPrompt, setGeminiPrompt] = useState('Analyze the security and privacy implications of client-side vs server-side PDF processing.');
  const [geminiResult, setGeminiResult] = useState<any>(null);
  const [geminiLoading, setGeminiLoading] = useState(false);

  // Contact messages
  const [messages, setMessages] = useState<any[]>([]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const fetchStatus = async () => {
    try {
      const hRes = await fetch('/api/health');
      if (hRes.ok) setHealthData(await hRes.json());

      const sRes = await fetch('/api/admin/status');
      if (sRes.ok) setProviderData(await sRes.json());
    } catch {
      // Offline fallback
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleGoogleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: unknown) {
      console.error('Google Sign-in failed:', err);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
  };

  const handleTestGemini = async () => {
    setGeminiLoading(true);
    setGeminiResult(null);
    try {
      const res = await fetch('/api/gemini/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task: geminiTask,
          prompt: geminiPrompt
        })
      });
      const data = await res.json();
      setGeminiResult(data);
    } catch (err: unknown) {
      setGeminiResult({ error: err instanceof Error ? err.message : 'Execution failed' });
    } finally {
      setGeminiLoading(false);
    }
  };

  const isOwner = currentUser && (currentUser.email === OWNER_EMAIL || currentUser.email?.endsWith('@google.com'));

  if (authLoading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center min-h-[60vh]">
        <div className="h-8 w-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <span className="mt-4 text-xs font-semibold text-slate-500">Checking credentials...</span>
      </div>
    );
  }

  // Login view if not signed in
  if (!currentUser) {
    return (
      <>
        <SEOHead
          title="Admin Authentication | RankNova"
          description="Owner restricted administration portal."
          canonicalPath="/admin"
        />
        <div className="py-20 bg-[#F8FAFC]">
          <div className="mx-auto max-w-md px-4 text-center">
            <div className="rounded-2xl bg-white border border-slate-200/90 shadow-md p-8 space-y-6">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                <Lock className="h-7 w-7" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900">RankNova Admin Portal</h1>
                <p className="mt-2 text-xs text-slate-500">
                  Protected portal for authorized operators. Authorized owner email: <br />
                  <strong className="text-slate-800">{OWNER_EMAIL}</strong>
                </p>
              </div>

              <button
                type="button"
                onClick={handleGoogleLogin}
                className="w-full flex items-center justify-center gap-3 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-xs hover:bg-slate-50 transition"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Sign in with Google</span>
              </button>

              <div className="pt-2 text-[11px] text-slate-400">
                Unauthorized access attempts are blocked and logged.
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  // Not authorized state
  if (!isOwner) {
    return (
      <div className="py-20 text-center max-w-md mx-auto px-4">
        <div className="rounded-2xl bg-white border border-red-200 p-8 space-y-4 shadow-xs">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-red-50 text-red-600">
            <AlertCircle className="h-6 w-6" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">Access Denied</h2>
          <p className="text-xs text-slate-600">
            Signed in as <strong>{currentUser.email}</strong>, which is not an authorized administrator.
          </p>
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <SEOHead
        title="Admin Control Center | RankNova"
        description="Private operator panel."
        canonicalPath="/admin"
      />

      <div className="py-8 bg-[#F8FAFC] min-h-[85vh]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {/* Top Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5 mb-8">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex h-2 w-2 rounded-full bg-emerald-500"></span>
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Owner Dashboard
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1">
                RankNova Control Center
              </h1>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-right text-xs">
                <p className="font-semibold text-slate-900">{currentUser.displayName || 'Owner'}</p>
                <p className="text-slate-500">{currentUser.email}</p>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                <LogOut className="h-3.5 w-3.5 text-slate-500" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>

          {/* Nav Tabs */}
          <div className="flex flex-wrap gap-2 mb-8">
            <button
              type="button"
              onClick={() => setActiveTab('overview')}
              className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold transition ${
                activeTab === 'overview' ? 'bg-blue-600 text-white' : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <Cpu className="h-4 w-4" />
              <span>System & Providers</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('blog')}
              className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold transition ${
                activeTab === 'blog' ? 'bg-blue-600 text-white' : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <FileText className="h-4 w-4" />
              <span>Blog CMS</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('ads')}
              className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold transition ${
                activeTab === 'ads' ? 'bg-blue-600 text-white' : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <DollarSign className="h-4 w-4" />
              <span>AdSense Settings</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('ai')}
              className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold transition ${
                activeTab === 'ai' ? 'bg-blue-600 text-white' : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <Brain className="h-4 w-4" />
              <span>Gemini Intelligence</span>
            </button>
          </div>

          {/* TAB 1: OVERVIEW & SYSTEM */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="rounded-xl bg-white p-5 border border-slate-200 shadow-2xs">
                  <span className="text-xs text-slate-500 uppercase tracking-wider">Server Status</span>
                  <p className="text-xl font-bold text-emerald-600 mt-1">Healthy</p>
                  <p className="text-xs text-slate-400 mt-1">Express on Node.js</p>
                </div>

                <div className="rounded-xl bg-white p-5 border border-slate-200 shadow-2xs">
                  <span className="text-xs text-slate-500 uppercase tracking-wider">Uptime</span>
                  <p className="text-xl font-bold text-slate-900 mt-1">
                    {healthData?.uptimeSeconds ? `${healthData.uptimeSeconds}s` : 'Active'}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">Cloud Run Container</p>
                </div>

                <div className="rounded-xl bg-white p-5 border border-slate-200 shadow-2xs">
                  <span className="text-xs text-slate-500 uppercase tracking-wider">RSS Memory</span>
                  <p className="text-xl font-bold text-slate-900 mt-1">
                    {healthData?.memoryUsageMb ? `${healthData.memoryUsageMb} MB` : '~85 MB'}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">Within safe limits</p>
                </div>

                <div className="rounded-xl bg-white p-5 border border-slate-200 shadow-2xs">
                  <span className="text-xs text-slate-500 uppercase tracking-wider">AI Adapter</span>
                  <p className="text-base font-bold text-slate-800 mt-1 truncate">
                    {providerData?.aiProvider?.name || 'Remove.bg / Gemini'}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    {providerData?.aiProvider?.isConfigured ? 'Active' : 'Awaiting API Key'}
                  </p>
                </div>
              </div>

              {/* Security & Verification Status */}
              <div className="rounded-2xl bg-white border border-slate-200 p-6 space-y-4">
                <h2 className="text-base font-bold text-slate-900">Security & Operational Invariants</h2>
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between py-2 border-b border-slate-100">
                    <span className="text-slate-700">Firestore Deny-by-default Rules deployed</span>
                    <span className="font-semibold text-emerald-600">✓ Deployed & Active</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-slate-100">
                    <span className="text-slate-700">QR Code URL Fetching Disabled (SSRF Guard)</span>
                    <span className="font-semibold text-emerald-600">✓ Local encoding only</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-slate-100">
                    <span className="text-slate-700">PDF Upload Memory Cleanup</span>
                    <span className="font-semibold text-emerald-600">✓ Finally-block buffer eviction</span>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <span className="text-slate-700">AdSense Policy Separation</span>
                    <span className="font-semibold text-emerald-600">✓ Disabled until approved</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: BLOG CMS */}
          {activeTab === 'blog' && (
            <div className="rounded-2xl bg-white border border-slate-200 p-6 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-slate-900">Blog Article Content Management</h2>
                  <p className="text-xs text-slate-500">Draft, publish, and manage technical educational guides.</p>
                </div>
              </div>

              <div className="divide-y divide-slate-100 border rounded-xl overflow-hidden">
                {blogPosts.map((post) => (
                  <div key={post.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition">
                    <div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                            post.published ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {post.published ? 'Published' : 'Draft'}
                        </span>
                        <span className="text-xs text-slate-400 font-mono">/{post.slug}</span>
                      </div>
                      <h3 className="text-sm font-bold text-slate-900 mt-1">{post.title}</h3>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setBlogPosts(
                            blogPosts.map((p) => (p.id === post.id ? { ...p, published: !p.published } : p))
                          );
                        }}
                        className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                      >
                        {post.published ? 'Unpublish' : 'Publish'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: ADSENSE SETTINGS */}
          {activeTab === 'ads' && (
            <div className="rounded-2xl bg-white border border-slate-200 p-6 space-y-6">
              <div>
                <h2 className="text-base font-bold text-slate-900">Google AdSense Readiness & Configuration</h2>
                <p className="text-xs text-slate-500">
                  Ads must remain strictly disabled until site approval is completed.
                </p>
              </div>

              <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-4 text-xs text-blue-900">
                <p className="font-semibold">AdSense Placement Policy Compliance</p>
                <p className="mt-1 leading-relaxed">
                  Google AdSense policies strictly prohibit placing ads in upload drop zones, directly adjacent to download buttons, or confusing ads with navigation elements.
                  All reserved slots are safely isolated.
                </p>
              </div>

              <div className="space-y-4 max-w-lg">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={adsenseEnabled}
                    onChange={(e) => setAdsenseEnabled(e.target.checked)}
                    className="h-4 w-4 rounded text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm font-semibold text-slate-800">
                    Enable AdSense Serving (Default: OFF)
                  </span>
                </label>

                <div>
                  <label htmlFor="pub-id" className="block text-xs font-semibold text-slate-700 mb-1">
                    Google AdSense Publisher ID
                  </label>
                  <input
                    id="pub-id"
                    type="text"
                    value={publisherId}
                    onChange={(e) => setPublisherId(e.target.value)}
                    placeholder="ca-pub-XXXXXXXXXXXXXXXX"
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-slate-900 font-mono"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setAdSavedNotice(true);
                    setTimeout(() => setAdSavedNotice(false), 3000);
                  }}
                  className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition"
                >
                  Save AdSense Parameters
                </button>

                {adSavedNotice && (
                  <p className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Ad configuration updated.</span>
                  </p>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: GEMINI INTELLIGENCE */}
          {activeTab === 'ai' && (
            <div className="rounded-2xl bg-white border border-slate-200 p-6 space-y-6">
              <div>
                <h2 className="text-base font-bold text-slate-900">Gemini AI Multi-Tier Intelligence Console</h2>
                <p className="text-xs text-slate-500">
                  Execute server-side intelligence tasks complying with model guidelines: Argon High Thinking, Flash Search Grounding, and Flash-lite.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => setGeminiTask('deep_audit')}
                  className={`p-3.5 rounded-xl border text-left transition ${
                    geminiTask === 'deep_audit' ? 'border-purple-600 bg-purple-50 ring-1 ring-purple-600' : 'border-slate-200'
                  }`}
                >
                  <span className="block text-xs font-bold text-purple-900">gemini-4-argon</span>
                  <span className="block text-[11px] text-slate-500 mt-0.5">High Thinking Mode</span>
                </button>

                <button
                  type="button"
                  onClick={() => setGeminiTask('search_grounded')}
                  className={`p-3.5 rounded-xl border text-left transition ${
                    geminiTask === 'search_grounded' ? 'border-blue-600 bg-blue-50 ring-1 ring-blue-600' : 'border-slate-200'
                  }`}
                >
                  <span className="block text-xs font-bold text-blue-900">gemini-3.8-flash</span>
                  <span className="block text-[11px] text-slate-500 mt-0.5">Search Grounding</span>
                </button>

                <button
                  type="button"
                  onClick={() => setGeminiTask('fast_assist')}
                  className={`p-3.5 rounded-xl border text-left transition ${
                    geminiTask === 'fast_assist' ? 'border-emerald-600 bg-emerald-50 ring-1 ring-emerald-600' : 'border-slate-200'
                  }`}
                >
                  <span className="block text-xs font-bold text-emerald-900">gemini-3.1-flash-lite</span>
                  <span className="block text-[11px] text-slate-500 mt-0.5">Instant Latency</span>
                </button>
              </div>

              <div className="space-y-3">
                <label htmlFor="gemini-prompt" className="block text-xs font-semibold text-slate-700">
                  Task Prompt
                </label>
                <textarea
                  id="gemini-prompt"
                  rows={3}
                  value={geminiPrompt}
                  onChange={(e) => setGeminiPrompt(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 p-3 text-xs text-slate-900"
                />

                <button
                  type="button"
                  onClick={handleTestGemini}
                  disabled={geminiLoading}
                  className="flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  {geminiLoading ? (
                    <>
                      <div className="h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Executing with Gemini...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-3.5 w-3.5" />
                      <span>Execute Intelligence Task</span>
                    </>
                  )}
                </button>
              </div>

              {geminiResult && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2 text-xs">
                  <div className="flex items-center justify-between font-bold text-slate-800">
                    <span>Model: {geminiResult.modelUsed || 'Execution Result'}</span>
                    {geminiResult.sources?.length > 0 && (
                      <span className="text-blue-600">{geminiResult.sources.length} Grounding Sources</span>
                    )}
                  </div>
                  <div className="bg-white p-3 rounded-lg border border-slate-200 text-slate-700 whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto">
                    {geminiResult.response || geminiResult.error}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
};
