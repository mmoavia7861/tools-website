import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, Bot, CheckCircle2, ChevronDown, FileText, LockKeyhole, MessageCircle, Send, Sparkles, WandSparkles, X } from 'lucide-react';
import {
  QUICK_QUESTIONS, isAssistantPath, makeCardPrompt, suggestTool,
  type AssistantAdvice, type AssistantPath
} from '../utils/toolAssistant';
import type { CardKind } from '../utils/aiCard';

const API_URL = (import.meta.env.VITE_AI_CARD_API_URL || '').trim().replace(/\/+$/, '');
const SITE_KEY = (import.meta.env.VITE_TURNSTILE_SITE_KEY || '').trim();
const GEMINI_READY = /^https:\/\//.test(API_URL) && Boolean(SITE_KEY);

type ChatMessage = {
  id: number;
  role: 'user' | 'assistant';
  text: string;
  advice?: AssistantAdvice;
  source?: 'local' | 'gemini';
};
const INTRO: ChatMessage = {
  id: 0, role: 'assistant',
  text: 'Assalam o Alaikum! Main ToolCresta Guide hoon. Visiting, wedding ya birthday card ke ideas aur PDF tools ke steps poochhein. Quick guide aapke browser mein kaam karta hai.',
  source: 'local'
};

export const ToolAssistant: React.FC<{ navigate: (path: string) => void }> = ({ navigate }) => {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([INTRO]);
  const [question, setQuestion] = useState('');
  const [busy, setBusy] = useState(false);
  const [token, setToken] = useState('');
  const [verification, setVerification] = useState('');
  const [error, setError] = useState('');
  const counter = useRef(1);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const widgetRef = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | number | null>(null);
  const requestRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (open && listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, open, busy]);

  useEffect(() => {
    if (!open || !GEMINI_READY || !widgetRef.current) return;
    let cancelled = false;
    let tries = 0;
    const display = () => {
      if (cancelled || !widgetRef.current || widgetId.current !== null) return;
      const turnstile = (window as any).turnstile;
      if (!turnstile?.render) return;
      try {
        widgetId.current = turnstile.render(widgetRef.current, {
          sitekey: SITE_KEY,
          callback: (value: string) => { setToken(value); setVerification('Verified for one Gemini question.'); },
          'expired-callback': () => { setToken(''); setVerification('Verification expired. Please verify again.'); },
          'error-callback': () => { setToken(''); setVerification('Verification failed. Try again.'); }
        });
      } catch {
        setVerification('Verification could not load. Local guide still works.');
      }
    };
    let script = document.querySelector<HTMLScriptElement>('script[data-ranknova-turnstile]');
    if (!script) {
      script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = true;
      script.defer = true;
      script.dataset.ranknovaTurnstile = '1';
      document.head.appendChild(script);
    }
    script.addEventListener('load', display);
    display();
    const interval = window.setInterval(() => {
      display();
      if (++tries >= 50) window.clearInterval(interval);
    }, 400);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
      script?.removeEventListener('load', display);
      if (widgetId.current !== null) {
        try { (window as any).turnstile?.remove(widgetId.current); } catch { /* Already removed */ }
        widgetId.current = null;
      }
      setToken('');
    };
  }, [open]);

  useEffect(() => () => { requestRef.current?.abort(); }, []);

  const append = (entry: Omit<ChatMessage, 'id'>) => {
    setMessages(prev => [...prev, { ...entry, id: counter.current++ }].slice(-16));
  };

  const send = async (raw: string, mode: 'local' | 'gemini' = 'local') => {
    const input = raw.trim().slice(0, 900);
    if (!input || busy) return;
    setQuestion('');
    setError('');
    const history = messages.slice(-6).map(message => ({
      role: message.role === 'user' ? 'user' : 'model',
      text: message.text.slice(0, 350)
    }));
    append({ role: 'user', text: input });
    if (mode === 'local') {
      append({ role: 'assistant', text: suggestTool(input).reply, advice: suggestTool(input), source: 'local' });
      return;
    }
    if (!GEMINI_READY || !token) {
      append({ role: 'assistant', text: 'Gemini ke liye anti-bot verification complete karein. Ya Quick Guide button use karein.', source: 'local' });
      return;
    }
    setBusy(true);
    const controller = new AbortController();
    requestRef.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 29000);
    try {
      const response = await fetch(API_URL + '/api/assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: input, history, token }),
        signal: controller.signal
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.success || typeof data.reply !== 'string') {
        throw new Error(typeof data?.error === 'string' ? data.error : 'Gemini assistant is unavailable.');
      }
      const kind: CardKind | undefined = ['visiting', 'wedding', 'birthday'].includes(data.cardKind) ? data.cardKind : undefined;
      const path: AssistantPath | undefined = isAssistantPath(data.toolPath) ? data.toolPath : undefined;
      const advice: AssistantAdvice | undefined = path ? {
        reply: data.reply.slice(0, 1300),
        toolPath: path,
        actionLabel: kind ? 'Suggested card banayein' : 'Suggested tool kholein',
        cardKind: kind,
        cardPrompt: kind ? (typeof data.cardPrompt === 'string' && data.cardPrompt.trim()
          ? data.cardPrompt.slice(0, 1400)
          : makeCardPrompt(kind, input)) : undefined
      } : undefined;
      append({ role: 'assistant', text: data.reply.slice(0, 1300), advice, source: 'gemini' });
    } catch (err) {
      const reason = err instanceof Error ? err.message : 'Service unavailable';
      append({ role: 'assistant', text: 'Gemini request complete nahi hui (' + reason.slice(0, 140) + '). Quick Guide abhi bhi available hai.', source: 'local' });
    } finally {
      window.clearTimeout(timeout);
      requestRef.current = null;
      setBusy(false);
      setToken('');
      if (widgetId.current !== null) {
        try { (window as any).turnstile?.reset(widgetId.current); } catch { /* Widget closed */ }
      }
    }
  };

  const openTool = (advice: AssistantAdvice) => {
    if (!advice.toolPath) return;
    if (advice.cardKind && advice.cardPrompt) {
      try {
        sessionStorage.setItem('toolcresta:card-prompt', JSON.stringify({
          kind: advice.cardKind,
          prompt: advice.cardPrompt.slice(0, 1400)
        }));
        window.dispatchEvent(new Event('toolcresta:card-prompt'));
      } catch { /* Private browsing may block storage; navigation still works. */ }
    }
    navigate(advice.toolPath);
    setOpen(false);
  };

  return (
    <div className="fixed bottom-4 right-4 z-[60] sm:bottom-6 sm:right-6" data-testid="tool-assistant">
      {open && (
        <section
          role="dialog"
          aria-label="ToolCresta card and PDF assistant"
          className="mb-3 flex w-[calc(100vw-2rem)] max-w-[390px] flex-col overflow-hidden rounded-2xl border border-blue-100 bg-white shadow-2xl shadow-slate-900/20"
          style={{ maxHeight: 'min(72dvh, 650px)' }}
          onKeyDown={event => { if (event.key === 'Escape') setOpen(false); }}
        >
          <header className="flex shrink-0 items-center justify-between bg-gradient-to-r from-blue-700 to-indigo-700 px-4 py-3.5 text-white">
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20">
                <Bot className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <h2 className="text-sm font-bold">ToolCresta Guide</h2>
                <p className="text-[11px] text-blue-100">Cards, PDF tools & design ideas</p>
              </div>
            </div>
            <button type="button" aria-label="Close assistant" onClick={() => setOpen(false)}
              className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-white">
              <X className="h-5 w-5" />
            </button>
          </header>

          <div ref={listRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-slate-50 px-3.5 py-4" aria-live="polite" aria-relevant="additions text">
            {messages.map(message => (
              <div key={message.id} className={message.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
                <div className={'max-w-[93%] rounded-2xl px-3.5 py-3 text-[13px] leading-relaxed shadow-sm ' +
                  (message.role === 'user' ? 'rounded-br-sm bg-blue-600 text-white' : 'rounded-bl-sm border border-slate-200 bg-white text-slate-700')}>
                  <p className="whitespace-pre-wrap break-words">{message.text}</p>
                  {message.role === 'assistant' && message.source && (
                    <p className="mt-2 flex items-center gap-1 text-[10px] text-slate-400">
                      {message.source === 'gemini' ? <Sparkles className="h-3 w-3" /> : <LockKeyhole className="h-3 w-3" />}
                      {message.source === 'gemini' ? 'Gemini AI' : 'On-device guide'}
                    </p>
                  )}
                  {message.advice?.toolPath && (
                    <button type="button" onClick={() => openTool(message.advice!)}
                      className="mt-2 flex min-h-9 items-center gap-1.5 rounded-lg bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100 focus-visible:outline-2 focus-visible:outline-blue-600">
                      <ArrowRight className="h-3.5 w-3.5" />
                      {message.advice.actionLabel || 'Tool kholein'}
                    </button>
                  )}
                </div>
              </div>
            ))}
            {busy && <p className="flex items-center gap-2 text-xs text-slate-500"><Sparkles className="h-4 w-4 animate-pulse" /> Gemini se suggestion aa rahi hai...</p>}
          </div>

          <div className="shrink-0 space-y-3 border-t border-slate-200 bg-white p-3">
            <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Suggested questions">
              {QUICK_QUESTIONS.map(suggestion => (
                <button key={suggestion} type="button" disabled={busy} onClick={() => void send(suggestion)}
                  className="shrink-0 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-[11px] font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50">
                  {suggestion}
                </button>
              ))}
            </div>
            <label className="sr-only" htmlFor="toolcresta-assistant-input">Ask about cards or PDF tools</label>
            <textarea
              id="toolcresta-assistant-input"
              ref={inputRef}
              value={question}
              onChange={event => setQuestion(event.target.value)}
              onKeyDown={event => {
                if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                  event.preventDefault();
                  void send(question);
                }
              }}
              rows={2}
              maxLength={900}
              placeholder="Misal: PDF par sign kaise karun?"
              className="w-full resize-none rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1 text-[10px] text-slate-500"><CheckCircle2 className="h-3 w-3 text-emerald-600" /> Quick Guide free & private</span>
              <button type="button" disabled={busy || !question.trim()} onClick={() => void send(question)}
                className="flex min-h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">
                <Send className="h-3.5 w-3.5" /> Ask Guide
              </button>
            </div>
            {GEMINI_READY && (
              <div className="space-y-1.5 border-t border-slate-100 pt-2">
                <div ref={widgetRef} className="max-w-full overflow-hidden" />
                <p className="text-[10px] leading-relaxed text-slate-500">
                  {verification || 'Optional: verify to ask Gemini AI. Your typed question and recent chat messages will be sent to Google via Cloudflare.'}
                </p>
                <button type="button" disabled={busy || !token || !question.trim()} onClick={() => void send(question, 'gemini')}
                  className="flex min-h-9 w-full items-center justify-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-50">
                  <WandSparkles className="h-4 w-4" /> Ask Gemini AI
                </button>
              </div>
            )}
            {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
            <p className="flex items-start gap-1 text-[10px] leading-relaxed text-slate-400">
              <FileText className="mt-0.5 h-3 w-3 shrink-0" /> Guide file content nahi dekhta aur documents automatically upload nahi karta.
            </p>
          </div>
        </section>
      )}
      <button
        type="button"
        onClick={() => setOpen(value => !value)}
        aria-label={open ? 'Minimize ToolCresta assistant' : 'Open ToolCresta assistant'}
        aria-expanded={open}
        className="ml-auto flex min-h-13 items-center gap-2 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3 text-sm font-bold text-white shadow-xl shadow-blue-600/25 transition hover:scale-[1.03] hover:shadow-2xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 motion-reduce:transform-none"
      >
        {open ? <ChevronDown className="h-5 w-5" /> : <MessageCircle className="h-5 w-5" />}
        <span>{open ? 'Close guide' : 'Ask ToolCresta'}</span>
        {!open && <Sparkles className="h-4 w-4 text-blue-100" />}
      </button>
    </div>
  );
};
