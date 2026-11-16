import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import { signInWithCustomToken, signOut } from 'firebase/auth';
import { auth } from '../services/firebase';

type OtpReply = {
  success?: boolean;
  error?: string;
  errorCode?: string;
  message?: string;
  customToken?: string;
  expiresAt?: number;
};

async function checkOtpConfiguration(user: User): Promise<string[]> {
  try {
    const response = await fetch('/api/admin/otp/status', {
      method: 'GET',
      credentials: 'same-origin',
      headers: { 'Authorization': 'Bearer ' + await user.getIdToken() },
      cache: 'no-store'
    });
    if (!response.ok) return [];
    const report = await response.json() as { configured?: boolean; missing?: unknown };
    return Array.isArray(report.missing) ?
      report.missing.filter((item): item is string => typeof item === 'string') : [];
  } catch { return []; }
}

async function postOtp(user: User, action: 'send' | 'verify', code?: string): Promise<OtpReply> {
  const token = await user.getIdToken();
  const response = await fetch('/api/admin/otp/' + action, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify(action === 'verify' ? { code } : {}),
  });
  const result = await response.json() as OtpReply;
  if (!response.ok || !result.success) throw new Error(result.error || 'Verification service unavailable.');
  return result;
}

export function AdminOtpChallenge({ user }: { user: User }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [secondsRemaining, setSecondsRemaining] = useState<number | null>(null);
  const requestedOnMount = useRef(false);

  useEffect(() => {
    if (expiresAt === null) {
      setSecondsRemaining(null);
      return;
    }
    const tick = () => setSecondsRemaining(Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000)));
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [expiresAt]);

  const expired = sent && secondsRemaining === 0;
  const readableTime = secondsRemaining !== null
    ? `${Math.floor(secondsRemaining / 60)}:${String(secondsRemaining % 60).padStart(2, '0')}`
    : null;

  const sendCode = useCallback(async () => {
    if (sending || busy) return;
    setSending(true);
    setError('');
    setNotice('');
    try {
      const result = await postOtp(user, 'send');
      setCode('');
      setSent(true);
      // Backend returns the actual expiry; local countdown is informational only.
      // The Durable Object remains the authority for code expiration.
      const deadline = typeof result.expiresAt === 'number' && Number.isFinite(result.expiresAt)
        ? result.expiresAt : Date.now() + 5 * 60 * 1000;
      setExpiresAt(deadline);
      setSecondsRemaining(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));
      setNotice(result.message || 'Verification code sent. Check your Gmail inbox.');
    } catch (err) {
      const reason = err instanceof Error ? err.message : 'Unable to send verification code.';
      const missing = await checkOtpConfiguration(user);
      setError(missing.length
        ? 'Cloudflare OTP configuration incomplete. Missing or invalid setting names: ' + missing.join(', ') + '. No secret values are displayed.'
        : reason);
    } finally {
      setSending(false);
    }
  }, [user, sending, busy]);

  useEffect(() => {
    // Automatic code delivery immediately after successful password login.
    // Avoid duplicate sends if React runs the effect again.
    if (requestedOnMount.current) return;
    requestedOnMount.current = true;
    void sendCode();
  }, [sendCode]);

  const verify = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy || !/^\d{6}$/.test(code)) {
      setError('Please enter all six digits from your email.');
      return;
    }
    if (expired) {
      setError('Your code has expired. Request a new email code.');
      setCode('');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const result = await postOtp(user, 'verify', code);
      if (!result.customToken) throw new Error('Secure session could not be issued.');
      // This Firebase sign-in does NOT produce admin privileges until the
      // server validates the OTP and signs its own limited custom token.
      await signInWithCustomToken(auth, result.customToken);
      setCode('');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to verify the email code.';
      if (/expired|unavailable|session changed|no active verification code/i.test(message)) {
        setCode('');
        setExpiresAt(null);
        setSent(false);
        setNotice('');
      }
      setError(message);
    } finally { setBusy(false); }
  };

  return (
    <div className="py-16 bg-[#F8FAFC] min-h-[70vh]">
      <div className="mx-auto max-w-md px-4">
        <div className="rounded-2xl border border-slate-200 bg-white shadow-md p-8 space-y-5">
          <div className="flex items-center justify-center rounded-2xl bg-blue-50 text-blue-600 w-14 h-14 text-2xl" aria-hidden="true">✉</div>
          <h1 className="text-2xl font-bold text-slate-900">Verify admin login</h1>
          <p className="text-sm text-slate-600">
            Password accepted. For security, enter the 6-digit one-time code sent to your authorized Gmail address.
            Codes expire in 5 minutes and work only once.
          </p>
          <form onSubmit={verify} className="space-y-4">
            <label htmlFor="admin-email-otp" className="block text-sm font-semibold text-slate-700">Email verification code</label>
            <input id="admin-email-otp" type="text" inputMode="numeric" autoComplete="one-time-code"
              pattern="[0-9]{6}" maxLength={6} required
              placeholder="••••••" value={code}
              onChange={event => { setCode(event.target.value.replace(/\D/g, '').slice(0, 6)); setError(''); }}
              aria-describedby="admin-otp-progress"
              className="w-full rounded-xl border border-slate-300 p-3 text-center text-2xl tracking-[0.45em] focus:border-blue-600 outline-none" />
            <p id="admin-otp-progress" role="status" className={code.length === 6 ? "text-xs text-emerald-700" : "text-xs text-slate-600"}>
              {code.length === 6
                ? "All 6 digits entered. You can verify your code now."
                : `Enter the full 6-digit code (${code.length}/6 digits entered). The button activates only when all six digits are present.`}
            </p>
            <button type="submit" disabled={busy || code.length !== 6 || expired}
              className="w-full rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white disabled:opacity-50">
              {busy ? 'Verifying…' : expired ? 'Code expired — request a new code' : code.length !== 6 ? `Enter all 6 digits (${code.length}/6)` : 'Verify code & open admin panel'}
            </button>
          </form>
          {sent && <p className={expired ? "text-sm font-semibold text-amber-800" : "text-sm text-slate-700"} role="status">
            {expired
              ? 'This code is no longer valid. Request a new one before verifying.'
              : `Code expires in ${readableTime ?? '5:00'} (5-minute validity). Only the newest email code works.`}
          </p>}
          <button type="button" onClick={() => void sendCode()} disabled={sending || busy}
            className="text-sm font-semibold text-blue-600 hover:underline disabled:opacity-50">
            {sending ? 'Sending verification code…' : sent ? 'Request a new code (60-second resend limit)' : 'Send verification code'}
          </button>
          {notice && <p role="status" className="rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-900">{notice}</p>}
          {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <button type="button" onClick={() => void signOut(auth)}
            className="block text-sm text-slate-500 hover:underline">Cancel and sign out</button>
          <p className="text-xs text-slate-500">Never share your code or password. No admin data is available until code verification succeeds.</p>
        </div>
      </div>
    </div>
  );
}
