import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import { signInWithCustomToken, signOut } from 'firebase/auth';
import { auth } from '../services/firebase';

type OtpReply = { success?: boolean; error?: string; message?: string; customToken?: string };

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
  const requestedOnMount = useRef(false);

  const sendCode = useCallback(async () => {
    if (sending || busy) return;
    setSending(true);
    setError('');
    setNotice('');
    try {
      const result = await postOtp(user, 'send');
      setSent(true);
      setNotice(result.message || 'Verification code sent. Check your Gmail inbox.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to send verification code.');
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
      setError('Please enter the six-digit code from your email.');
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
      setError(err instanceof Error ? err.message : 'Invalid or expired code.');
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
              onChange={event => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
              className="w-full rounded-xl border border-slate-300 p-3 text-center text-2xl tracking-[0.45em] focus:border-blue-600 outline-none" />
            <button type="submit" disabled={busy || code.length !== 6}
              className="w-full rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white disabled:opacity-50">
              {busy ? 'Verifying…' : 'Verify code & open admin panel'}
            </button>
          </form>
          <button type="button" onClick={() => void sendCode()} disabled={sending || busy}
            className="text-sm font-semibold text-blue-600 hover:underline disabled:opacity-50">
            {sending ? 'Sending verification code…' : sent ? 'Resend code (60-second cooldown)' : 'Send verification code'}
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
