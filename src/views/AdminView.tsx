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
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  sendEmailVerification,
  browserSessionPersistence,
  setPersistence,
  getIdTokenResult,
  reload,
  signOut,
  onAuthStateChanged,
  type User,
  db,
  collection,
  getDocs,
  updateDoc,
  query,
  orderBy,
  limit,
  doc,
  testConnection
} from '../services/firebase';
import { STARTER_BLOG_POSTS, type BlogPostItem } from '../data/initialContent';
import { OWNER_EMAIL, isOwnerOtpSession } from '../utils/adminAccess';
import { AdminOtpChallenge } from '../components/AdminOtpChallenge';

export const AdminView: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [loginError, setLoginError] = useState('');
  const [loginNotice, setLoginNotice] = useState('');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginBusy, setLoginBusy] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);
  const [verificationBusy, setVerificationBusy] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);
  const [authProvider, setAuthProvider] = useState<string | null>(null);
  const [otpVerified, setOtpVerified] = useState(false);
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

  // Only the verified Firebase owner can see saved support inquiries.
  type ContactMessage = {
    id: string;
    name: string;
    email: string;
    category: string;
    message: string;
    status: 'new' | 'read' | 'resolved';
    createdAt: string;
  };
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messagesError, setMessagesError] = useState('');
  const [messageUpdating, setMessageUpdating] = useState('');
  const [firestoreConnected, setFirestoreConnected] = useState<boolean | null>(null);

  const isOwner = isOwnerOtpSession(currentUser?.email, emailVerified, authProvider, otpVerified);

  useEffect(() => {
    let cancelled = false;
    // Password-only sessions may receive an OTP, but NEVER read admin data.
    // Only the OTP-verified custom provider gets admin privileges.
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        if (!cancelled) {
          setCurrentUser(null);
          setAuthProvider(null);
          setOtpVerified(false);
          setEmailVerified(false);
          setAuthLoading(false);
        }
        return;
      }
      try {
        const token = await getIdTokenResult(user);
        if (cancelled) return;
        const signedByOtpService = token.signInProvider === 'custom' &&
          token.claims.toolscresta_otp === true;
        if (user.email?.toLowerCase() !== OWNER_EMAIL ||
            (token.signInProvider !== 'password' && !signedByOtpService)) {
          await signOut(auth);
          if (!cancelled) {
            setCurrentUser(null);
            setAuthProvider(null);
            setOtpVerified(false);
            setEmailVerified(false);
            setLoginError('Sign in using the authorized admin Gmail address and password.');
          }
          return;
        }
        if (!cancelled) {
          setCurrentUser(user);
          setAuthProvider(token.signInProvider);
          setOtpVerified(signedByOtpService);
          setEmailVerified(user.emailVerified === true);
        }
      } catch {
        await signOut(auth).catch(() => {});
        if (!cancelled) {
          setCurrentUser(null);
          setAuthProvider(null);
          setOtpVerified(false);
          setEmailVerified(false);
          setLoginError('Unable to validate the sign-in session. Please try again.');
        }
      } finally {
        if (!cancelled) setAuthLoading(false);
      }
    });
    return () => { cancelled = true; unsubscribe(); };
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
    if (!isOwner) {
      setFirestoreConnected(null);
      setMessages([]);
      return;
    }
    let cancelled = false;
    void fetchStatus();
    void testConnection().then(connected => {
      if (!cancelled) setFirestoreConnected(connected);
    });
    return () => { cancelled = true; };
  }, [isOwner]);

  const loadMessages = async () => {
    if (!isOwner) return;
    setMessagesError('');
    setMessagesLoading(true);
    try {
      const results = await getDocs(query(
        collection(db, 'contact_messages'),
        orderBy('createdAt', 'desc'),
        limit(50)
      ));
      const records: ContactMessage[] = results.docs.map(result => {
        const value = result.data();
        return {
          id: result.id,
          name: typeof value.name === 'string' ? value.name : '',
          email: typeof value.email === 'string' ? value.email : '',
          category: typeof value.category === 'string' ? value.category : '',
          message: typeof value.message === 'string' ? value.message : '',
          status: value.status === 'resolved' || value.status === 'read' ? value.status : 'new',
          createdAt: typeof value.createdAt === 'string' ? value.createdAt : ''
        };
      });
      setMessages(records);
      setFirestoreConnected(true);
    } catch {
      setMessagesError('Unable to read inquiries from Firebase. Check the named Firestore database and deployed owner-only security rules.');
      setFirestoreConnected(false);
    } finally {
      setMessagesLoading(false);
    }
  };

  const updateMessageStatus = async (messageId: string, status: 'read' | 'resolved') => {
    if (!isOwner || messageUpdating) return;
    setMessagesError('');
    setMessageUpdating(messageId);
    try {
      await updateDoc(doc(db, 'contact_messages', messageId), { status });
      setMessages(current => current.map(message => message.id === messageId ? { ...message, status } : message));
    } catch {
      setMessagesError('Could not update this inquiry. Verify Firestore rules and try again.');
    } finally {
      setMessageUpdating('');
    }
  };

  useEffect(() => {
    if (isOwner && activeTab === 'messages') void loadMessages();
  }, [isOwner, activeTab]);

  const handlePasswordLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (loginBusy) return;
    setLoginError('');
    setLoginNotice('');
    // UX check only. Firebase Authentication + Firestore Security Rules are the
    // security boundary; never store admin credentials in this source code.
    if (loginEmail.trim().toLowerCase() !== OWNER_EMAIL || !loginPassword) {
      setLoginError('Invalid Gmail address or password.');
      return;
    }
    setLoginBusy(true);
    try {
      // Session expires when this browser tab/window session ends.
      await setPersistence(auth, browserSessionPersistence);
      await signInWithEmailAndPassword(auth, loginEmail.trim().toLowerCase(), loginPassword);
      setLoginPassword('');
    } catch (err: unknown) {
      const code = err && typeof err === 'object' && 'code' in err ? String(err.code) : '';
      if (code === 'auth/operation-not-allowed') {
        setLoginError('Email/Password sign-in is disabled in Firebase Authentication. Enable that provider in your Firebase project.');
      } else if (code === 'auth/too-many-requests') {
        setLoginError('Too many attempts. Please try again later or reset the password.');
      } else if (code === 'auth/unauthorized-domain') {
        setLoginError('This site is not an authorized Firebase Authentication domain.');
      } else {
        // Generic message prevents email/account enumeration.
        setLoginError('Invalid Gmail address or password.');
      }
    } finally {
      setLoginBusy(false);
    }
  };

  const handlePasswordReset = async () => {
    if (resetBusy) return;
    setLoginError('');
    setLoginNotice('');
    if (loginEmail.trim().toLowerCase() !== OWNER_EMAIL) {
      setLoginError('Enter your authorized Gmail address to request a reset link.');
      return;
    }
    setResetBusy(true);
    try {
      await sendPasswordResetEmail(auth, OWNER_EMAIL);
    } catch {
      // Do not leak whether an account exists or how it was provisioned.
    } finally {
      setLoginNotice('If this Gmail address has a password account, Firebase will send a reset email. Check your inbox and spam folder.');
      setResetBusy(false);
    }
  };

  const handleSendVerification = async () => {
    if (!currentUser || verificationBusy) return;
    setVerificationBusy(true);
    setLoginError('');
    setLoginNotice('');
    try {
      await sendEmailVerification(currentUser);
      setLoginNotice('Verification email sent. Open the link in your Gmail inbox, then return and select Refresh verification.');
    } catch {
      setLoginError('Could not send verification email. Check Firebase settings or try later.');
    } finally {
      setVerificationBusy(false);
    }
  };

  const refreshVerification = async () => {
    if (!currentUser || verificationBusy) return;
    setVerificationBusy(true);
    setLoginError('');
    try {
      await reload(currentUser);
      await currentUser.getIdToken(true);
      setEmailVerified(currentUser.emailVerified === true);
      if (!currentUser.emailVerified) {
        setLoginNotice('Email is not verified yet. Open the verification link in Gmail first.');
      } else {
        setLoginNotice('');
      }
    } catch {
      setLoginError('Could not refresh email verification. Please sign in again.');
    } finally {
      setVerificationBusy(false);
    }
  };

  const handleLogout = async () => {
    setLoginPassword('');
    setLoginNotice('');
    await signOut(auth);
  };

  if (authLoading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center min-h-[60vh]">
        <div className="h-8 w-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <span className="mt-4 text-xs font-semibold text-slate-500">Checking credentials...</span>
      </div>
    );
  }

  // Public-facing login has no signup or Google OAuth popup.
  if (!currentUser) {
    return (
      <>
        <SEOHead title="Admin Sign In | ToolsCresta" description="Private administration login." canonicalPath="/admin" />
        <div className="py-16 bg-[#F8FAFC] min-h-[70vh]">
          <div className="mx-auto max-w-md px-4">
            <div className="rounded-2xl border border-slate-200 bg-white shadow-md p-8 space-y-6">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                <Lock className="h-7 w-7" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900">ToolsCresta Admin Login</h1>
                <p className="mt-2 text-sm text-slate-500">Authorized Gmail + password, followed by an email verification code. No public registration.</p>
              </div>
              <form onSubmit={handlePasswordLogin} className="space-y-4">
                <div>
                  <label htmlFor="admin-email" className="block text-sm font-semibold text-slate-700 mb-2">Gmail address</label>
                  <input id="admin-email" name="email" type="email" required
                    autoComplete="username" inputMode="email"
                    value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="you@gmail.com"
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100" />
                </div>
                <div>
                  <label htmlFor="admin-password" className="block text-sm font-semibold text-slate-700 mb-2">Password</label>
                  <div className="relative">
                    <input id="admin-password" name="password" type={showPassword ? 'text' : 'password'}
                      required autoComplete="current-password"
                      value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="Enter admin password"
                      className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 pr-20 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100" />
                    <button type="button" onClick={() => setShowPassword(v => !v)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-2 text-xs font-semibold text-slate-600 hover:bg-slate-100">
                      {showPassword ? 'Hide' : 'Show'}
                    </button>
                  </div>
                </div>
                <button type="submit" disabled={loginBusy}
                  className="w-full rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
                  {loginBusy ? 'Signing in…' : 'Secure Admin Login'}
                </button>
              </form>
              <button type="button" disabled={resetBusy} onClick={handlePasswordReset}
                className="text-sm font-semibold text-blue-600 hover:underline disabled:opacity-50">
                {resetBusy ? 'Sending reset email…' : 'Forgot your password?'}
              </button>
              {loginError && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{loginError}</p>}
              {loginNotice && <p role="status" className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">{loginNotice}</p>}
              <p className="text-xs text-slate-500">Firebase verifies your password. Server-verified email OTP is required before admin permissions are granted.</p>
            </div>
          </div>
        </div>
      </>
    );
  }

  // A newly created email/password admin needs verified Gmail ownership.
  if (currentUser.email?.toLowerCase() === OWNER_EMAIL && !emailVerified) {
    return (
      <div className="py-20 max-w-md mx-auto px-4">
        <div className="rounded-2xl border border-amber-200 bg-white p-8 space-y-5 shadow-sm">
          <Mail className="h-8 w-8 text-amber-600" />
          <h1 className="text-xl font-bold text-slate-900">Verify your Gmail address</h1>
          <p className="text-sm text-slate-600">Your password is accepted, but admin access requires email verification. Check {OWNER_EMAIL}.</p>
          <button type="button" disabled={verificationBusy} onClick={handleSendVerification}
            className="w-full rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white disabled:opacity-50">Send verification email</button>
          <button type="button" disabled={verificationBusy} onClick={refreshVerification}
            className="w-full rounded-xl border border-slate-300 py-3 text-sm font-semibold text-slate-700 disabled:opacity-50">Refresh verification</button>
          <button type="button" onClick={handleLogout} className="text-sm text-slate-500 hover:underline">Sign out</button>
          {loginError && <p role="alert" className="text-sm text-red-700">{loginError}</p>}
          {loginNotice && <p role="status" className="text-sm text-blue-800">{loginNotice}</p>}
        </div>
      </div>
    );
  }

  // A correct password alone is intentionally insufficient for admin access.
  // This screen asks the trusted Worker to send/verify a one-time email code.
  if (authProvider === 'password' && currentUser.email?.toLowerCase() === OWNER_EMAIL) {
    return <AdminOtpChallenge user={currentUser} />;
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
        title="Admin Control Center | ToolsCresta"
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
                ToolsCresta Control Center
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
              <span>AI Assistant Setup</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('messages')}
              className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold transition ${
                activeTab === 'messages' ? 'bg-blue-600 text-white' : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <Mail className="h-4 w-4" />
              <span>Contact Inbox</span>
            </button>
          </div>

          {/* Only the verified owner can read private Firestore inquiries. */}
          {activeTab === 'messages' && (
            <div className="rounded-2xl bg-white border border-slate-200 p-6 space-y-5">
              <div className="flex flex-wrap gap-3 items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-slate-900">Contact Inbox</h2>
                  <p className="mt-1 text-xs text-slate-500">Latest 50 inquiries stored in Firebase Firestore. Visible only to the verified admin.</p>
                </div>
                <button type="button" onClick={() => void loadMessages()} disabled={messagesLoading}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50">
                  <RefreshCw className="inline h-4 w-4 mr-1" /> {messagesLoading ? 'Loading…' : 'Refresh'}
                </button>
              </div>
              {messagesError && <p role="alert" className="rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700">{messagesError}</p>}
              {messagesLoading && <p role="status" className="text-sm text-slate-500">Loading saved contact messages…</p>}
              {!messagesLoading && !messagesError && messages.length === 0 && (
                <p className="rounded-xl bg-slate-50 p-6 text-sm text-slate-600">No saved inquiries in this Firestore database yet.</p>
              )}
              <div className="space-y-3">
                {messages.map(message => (
                  <article key={message.id} className="rounded-xl border border-slate-200 p-4 space-y-3">
                    <div className="flex flex-wrap justify-between gap-2">
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">{message.name || 'Unnamed visitor'}</h3>
                        <p className="text-xs text-slate-600 break-all">{message.email}</p>
                      </div>
                      <div className="text-right text-xs text-slate-500">
                        <p>{message.category}</p>
                        <p>{message.createdAt ? new Date(message.createdAt).toLocaleString() : 'No timestamp'}</p>
                        <p className="font-semibold capitalize">{message.status}</p>
                      </div>
                    </div>
                    <p className="text-sm text-slate-800 whitespace-pre-wrap break-words">{message.message}</p>
                    <div className="flex gap-2">
                      <button type="button" disabled={messageUpdating === message.id || message.status !== 'new'}
                        onClick={() => void updateMessageStatus(message.id, 'read')}
                        className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-40">Mark read</button>
                      <button type="button" disabled={messageUpdating === message.id || message.status === 'resolved'}
                        onClick={() => void updateMessageStatus(message.id, 'resolved')}
                        className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-40">Resolve</button>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          )}

          {/* TAB 1: OVERVIEW & SYSTEM */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="rounded-xl bg-white p-5 border border-slate-200 shadow-2xs">
                  <span className="text-xs text-slate-500 uppercase tracking-wider">Hosting</span>
                  <p className="text-xl font-bold text-blue-600 mt-1">{window.location.hostname.endsWith('github.io') ? 'GitHub Pages' : 'Custom domain'}</p>
                  <p className="text-xs text-slate-400 mt-1">Cloud features require a Cloudflare Worker on this origin</p>
                </div>

                <div className="rounded-xl bg-white p-5 border border-slate-200 shadow-2xs">
                  <span className="text-xs text-slate-500 uppercase tracking-wider">Backend Uptime</span>
                  <p className="text-xl font-bold text-slate-900 mt-1">
                    {healthData?.status === 'ok' ? 'Online' : 'Not connected'}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">No backend health data available on Pages</p>
                </div>

                <div className="rounded-xl bg-white p-5 border border-slate-200 shadow-2xs">
                  <span className="text-xs text-slate-500 uppercase tracking-wider">Firebase Firestore</span>
                  <p className={`text-lg font-bold mt-1 ${firestoreConnected === true ? 'text-emerald-700' : firestoreConnected === false ? 'text-amber-700' : 'text-slate-900'}`}>
                    {firestoreConnected === null ? 'Checking…' : firestoreConnected ? 'Connected' : 'Check connection'}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">Read-only connection test against the configured database</p>
                </div>

                <div className="rounded-xl bg-white p-5 border border-slate-200 shadow-2xs">
                  <span className="text-xs text-slate-500 uppercase tracking-wider">AI Adapter</span>
                  <p className="text-base font-bold text-slate-800 mt-1 truncate">
                    {providerData?.aiProvider?.name || 'Not connected'}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    {providerData?.aiProvider?.isConfigured ? 'Configured' : 'Cloud AI backend not confirmed'}
                  </p>
                </div>
              </div>

              {/* Security & Verification Status */}
              <div className="rounded-2xl bg-white border border-slate-200 p-6 space-y-4">
                <h2 className="text-base font-bold text-slate-900">Security & Operational Invariants</h2>
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between py-2 border-b border-slate-100">
                    <span className="text-slate-700">Firestore access rules</span>
                    <span className="font-semibold text-amber-600">Verify in Firebase Console</span>
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
                  <p className="text-xs text-slate-500">Current article status is read-only. Live publishing requires an authenticated content backend and site-side data integration.</p>
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
                        disabled
                        title="Publishing is unavailable until the blog is connected to an owner-authorized content store."
                        className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                      >
                        {post.published ? 'Published (read-only)' : 'Draft (read-only)'}
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
                    checked={false}
                    disabled
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
                    readOnly
                    placeholder="ca-pub-XXXXXXXXXXXXXXXX"
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-slate-900 font-mono"
                  />
                </div>

                <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                  AdSense configuration is preview-only. These fields are not stored or deployed from this dashboard.
                  Ad serving remains disabled until a verified owner-only persistence flow and Google approval are configured.
                </p>
              </div>
            </div>
          )}

          {/* TAB 4: ASSISTANT & OPTIONAL GEMINI */}
          {activeTab === 'ai' && (
            <div className="rounded-2xl bg-white border border-slate-200 p-6 space-y-5">
              <div>
                <h2 className="text-base font-bold text-slate-900">ToolsCresta Assistant & Gemini Setup</h2>
                <p className="mt-2 text-sm text-slate-600">
                  Visitors can use the floating Ask ToolsCresta guide on every page for card design suggestions
                  and PDF tool instructions. The local guide works in the browser without a paid AI service.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                  <p className="text-xs font-bold text-emerald-800">Local guide</p>
                  <p className="mt-1 text-sm font-semibold text-emerald-900">Available without an API key</p>
                  <p className="mt-1 text-xs text-emerald-700">Suggestions, safe tool navigation and editable card prompts.</p>
                </div>
                <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4">
                  <p className="text-xs font-bold text-indigo-800">Gemini AI</p>
                  <p className="mt-1 text-sm font-semibold text-indigo-900">
                    {import.meta.env.VITE_AI_CARD_API_URL && import.meta.env.VITE_TURNSTILE_SITE_KEY
                      ? 'Frontend settings present — verify Worker health'
                      : 'Backend setup required'}
                  </p>
                  <p className="mt-1 text-xs text-indigo-700">Real AI answers need a secured Cloudflare Worker, Turnstile and a private Gemini key.</p>
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 p-4 text-sm text-slate-700">
                <p className="font-semibold text-slate-900">Activate optional Gemini suggestions</p>
                <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-xs">
                  <li>Add the required Cloudflare, Gemini and Turnstile values as encrypted GitHub Actions Secrets.</li>
                  <li>Deploy the card AI Worker and verify its /health endpoint.</li>
                  <li>Set the Worker URL and public Turnstile site key as GitHub Actions Variables, then redeploy the frontend.</li>
                </ol>
                <div className="mt-4 flex flex-wrap gap-3 text-xs font-semibold">
                  <a href="https://github.com/mmoavia7861/tools-website/settings/secrets/actions" target="_blank" rel="noopener noreferrer" className="text-blue-700 underline">Actions Secrets</a>
                  <a href="https://github.com/mmoavia7861/tools-website/actions" target="_blank" rel="noopener noreferrer" className="text-blue-700 underline">Deploy AI Worker</a>
                  <a href="https://github.com/mmoavia7861/tools-website/settings/variables/actions" target="_blank" rel="noopener noreferrer" className="text-blue-700 underline">Frontend Variables</a>
                </div>
              </div>
              <p className="text-xs text-slate-500">
                GitHub Pages is static hosting. The old /api/gemini/analyze tester cannot run on this site,
                so this panel shows the actual activation steps instead of a non-functional test button.
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
};
