import React, { useEffect, useRef, useState } from 'react';
import { Download, Sparkles, WandSparkles, RefreshCcw, Image as ImageIcon, Palette, ShieldCheck, AlertCircle, CheckCircle2, CreditCard, Heart, Cake, Lock } from 'lucide-react';
import { SEOHead } from '../components/SEOHead';
import { blankCard, cardSize, drawCardCanvas, draftFromPrompt, EXAMPLES, exportCardFile, PALETTES, sanitizeCardDraft, type CardDraft, type CardKind, type CardStyle, type CardFont } from '../utils/aiCard';

const API_URL = (import.meta.env.VITE_AI_CARD_API_URL || '').trim().replace(/\/+$/, '');
const SITE_KEY = (import.meta.env.VITE_TURNSTILE_SITE_KEY || '').trim();
const AI_READY = /^https:\/\//.test(API_URL) && Boolean(SITE_KEY);
const kinds: { kind: CardKind; label: string; description: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { kind: 'visiting', label: 'Visiting Card', description: 'Business and personal cards', icon: CreditCard },
  { kind: 'wedding', label: 'Wedding Card', description: 'Elegant invitations', icon: Heart },
  { kind: 'birthday', label: 'Birthday Card', description: 'Party invitations', icon: Cake }
];

function fileDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = fileName; document.body.appendChild(a); a.click(); a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30000);
}

export const AICardGeneratorView: React.FC<{ initialKind?: CardKind }> = ({ initialKind = 'visiting' }) => {
  const [kind, setKind] = useState<CardKind>(initialKind);
  const [prompt, setPrompt] = useState(EXAMPLES[initialKind]);
  const [draft, setDraft] = useState<CardDraft>(() => blankCard(initialKind));
  const [previewError, setPreviewError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState('');
  const [turnstileStatus, setTurnstileStatus] = useState('');
  const [activePanel, setActivePanel] = useState<'content'|'design'>('content');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const uploadRef = useRef<HTMLInputElement>(null);
  const widgetRef = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);

  const selectKind = (next: CardKind) => {
    setKind(next); setDraft(blankCard(next)); setPrompt(EXAMPLES[next]); setPreviewError(''); setNotice('');
  };
  const update = (field: keyof CardDraft, value: string) => {
    setDraft(prev => ({ ...prev, [field]: value }));
    setNotice('');
  };

  useEffect(() => {
    let cancelled = false;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const render = async () => {
      try {
        let image: HTMLImageElement | null = null;
        if (draft.imageData) {
          image = await new Promise<HTMLImageElement>((resolve,reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error('Image preview failed. Choose a different image.'));
            img.src = draft.imageData;
          });
        }
        if (!cancelled) { drawCardCanvas(canvas, draft, image); setPreviewError(''); }
      } catch (err) {
        if (!cancelled) setPreviewError(err instanceof Error ? err.message : 'Preview unavailable.');
      }
    };
    void render();
    return () => { cancelled = true; };
  }, [draft]);

  // Turnstile is mandatory for Gemini API access. No keys or secrets reach this page.
  useEffect(() => {
    if (!AI_READY || !widgetRef.current) return;
    let cancelled = false;
    let checks = 0;
    const display = () => {
      if (cancelled || !widgetRef.current || widgetId.current) return;
      const ts = (window as any).turnstile;
      if (!ts?.render) return;
      widgetId.current = ts.render(widgetRef.current, {
        sitekey: SITE_KEY,
        callback: (token: string) => { setTurnstileToken(token); setTurnstileStatus('Verification complete.'); },
        'expired-callback': () => { setTurnstileToken(''); setTurnstileStatus('Verification expired. Please verify again.'); },
        'error-callback': () => { setTurnstileToken(''); setTurnstileStatus('Verification failed. Please try again.'); }
      });
    };
    const handle = () => display();
    let script = document.querySelector<HTMLScriptElement>('script[data-ranknova-turnstile]');
    if (!script) {
      script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = true; script.defer = true;
      script.dataset.ranknovaTurnstile = '1';
      document.head.appendChild(script);
    }
    script.addEventListener('load', handle);
    const interval = window.setInterval(() => {
      display(); checks++;
      if (checks >= 60) window.clearInterval(interval);
    }, 500);
    display();
    return () => {
      cancelled = true;
      window.clearInterval(interval);
      script?.removeEventListener('load', handle);
      if (widgetId.current) {
        try { (window as any).turnstile?.remove(widgetId.current); } catch { /* widget already removed */ }
        widgetId.current = null;
      }
    };
  }, []);

  const createTemplate = () => {
    if (prompt.trim().length < 8) { setPreviewError('Describe your card in at least 8 characters.'); return; }
    const result = draftFromPrompt(kind, prompt);
    setDraft(result);
    setNotice('Local template created from recognized details. Review and fill missing fields; Gemini AI was not used.');
    setPreviewError('');
  };

  const generateWithAi = async () => {
    if (!AI_READY) { setPreviewError('Gemini API is not configured yet. Use Create Template for a free on-device design.'); return; }
    if (!turnstileToken) { setPreviewError('Complete the anti-bot verification before generating.'); return; }
    if (prompt.trim().length < 8 || prompt.length > 1500) { setPreviewError('Enter a prompt between 8 and 1500 characters.'); return; }
    setAiBusy(true); setPreviewError(''); setNotice('');
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 30000);
    try {
      const response = await fetch(API_URL + '/api/cards/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, prompt: prompt.trim(), token: turnstileToken }),
        signal: controller.signal
      });
      const json = await response.json().catch(() => null);
      if (!response.ok || !json?.success || !json?.design) {
        throw new Error(typeof json?.error === 'string' ? json.error : 'AI generation failed. Try again later.');
      }
      setDraft(sanitizeCardDraft(json.design,kind));
      setNotice('Gemini suggested the design. Review all details before sharing or printing.');
      setActivePanel('content');
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : 'AI service unavailable. Use local templates instead.');
    } finally {
      setAiBusy(false); setTurnstileToken(''); window.clearTimeout(timeout);
      if (widgetId.current) (window as any).turnstile?.reset(widgetId.current);
    }
  };

  const handleLogo = async (file: File) => {
    if (!['image/jpeg','image/png'].includes(file.type) || file.size > 2*1024*1024 || file.size <= 0) {
      setPreviewError('Choose a PNG or JPEG up to 2 MB.'); return;
    }
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      await new Promise<void>((resolve,reject) => {
        img.onload=()=>resolve(); img.onerror=()=>reject(new Error('Invalid image.')); img.src=url;
      });
      if (img.width*img.height > 12000000) throw new Error('Choose an image below 12 megapixels.');
      const canvas=document.createElement('canvas');
      const scale=Math.min(1,700/Math.max(img.width,img.height));
      canvas.width=Math.max(1,Math.round(img.width*scale));
      canvas.height=Math.max(1,Math.round(img.height*scale));
      const ctx=canvas.getContext('2d');
      if (!ctx) throw new Error('Could not prepare logo.');
      ctx.drawImage(img,0,0,canvas.width,canvas.height);
      update('imageData',canvas.toDataURL('image/png'));
      setPreviewError('');
    } catch(err) {
      setPreviewError(err instanceof Error?err.message:'Image could not be loaded.');
    } finally { URL.revokeObjectURL(url); }
  };

  const download = async (format: 'png'|'jpg'|'pdf') => {
    const canvas = canvasRef.current; if(!canvas || busy) return;
    setBusy(true);setPreviewError('');
    try {
      const blob = await exportCardFile(canvas,draft,format);
      if (!blob.size) throw new Error('Export returned an empty file.');
      fileDownload(blob, 'ranknova-' + kind + '-card.' + format);
      setNotice(format.toUpperCase() + ' created in your browser. Check names, dates and layout before printing.');
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : 'Download failed.');
    } finally { setBusy(false); }
  };

  const size = cardSize(kind);
  const title = kind === 'wedding' ? 'Wedding Card Maker' : kind === 'birthday' ? 'Birthday Card Maker' : 'AI Card Generator';
  const description = 'Design editable visiting, wedding and birthday cards from prompts and templates. Export real PNG, JPG and PDF files. Gemini generation requires a secure API connection.';

  const field = (key: keyof CardDraft, label: string, placeholder: string, multiline = false) => (
    <label key={key} className="flex flex-col gap-1.5 text-xs font-bold text-slate-700">
      <span>{label}</span>
      {multiline ? <textarea rows={2} maxLength={180} value={String(draft[key] || '')} onChange={e=>update(key,e.target.value)}
        placeholder={placeholder} className="w-full rounded-xl border border-slate-300 p-3 text-sm font-normal text-slate-900 focus:ring-2 focus:ring-blue-300" />
      : <input type="text" maxLength={130} value={String(draft[key] || '')} onChange={e=>update(key,e.target.value)}
        placeholder={placeholder} className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm font-normal text-slate-900 focus:ring-2 focus:ring-blue-300" />}
    </label>
  );

  return <div className="bg-slate-50 min-h-screen pb-20">
    <SEOHead title={title + ' | RankNova'} description={description} canonicalPath={kind==='wedding'?'/wedding-card-maker':kind==='birthday'?'/birthday-card-maker':'/ai-card-generator'}/>
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10">
      <div className="flex items-center gap-2 text-blue-700 text-xs font-bold tracking-wide uppercase"><Sparkles className="w-4 h-4"/> RankNova Creative Tools</div>
      <h1 className="mt-3 text-3xl sm:text-4xl font-extrabold text-slate-900">AI Card Generator & Invitation Maker</h1>
      <p className="mt-3 max-w-3xl text-slate-600 leading-relaxed">Create printable visiting cards, wedding invitations and birthday invitations. Design with free local templates now. Gemini-powered prompt generation activates after the secure API is connected.</p>

      <div className="mt-7 grid grid-cols-1 sm:grid-cols-3 gap-3" role="tablist" aria-label="Card type">
        {kinds.map(({kind:k,label,description:desc,icon:Icon})=><button type="button" key={k} role="tab" aria-selected={kind===k} onClick={()=>selectKind(k)}
          className={`flex items-center gap-3 rounded-2xl border p-4 text-left shadow-sm transition ${kind===k?'border-blue-600 bg-blue-50 ring-1 ring-blue-200':'border-slate-200 bg-white hover:border-blue-300'}`}>
          <Icon className={`w-6 h-6 ${kind===k?'text-blue-700':'text-slate-500'}`}/>
          <span><strong className="block text-sm text-slate-900">{label}</strong><span className="text-xs text-slate-500">{desc}</span></span>
        </button>)}
      </div>

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.08fr)] gap-6 items-start">
        <div className="space-y-5">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2"><WandSparkles className="w-5 h-5 text-blue-600"/><h2 className="text-lg font-bold text-slate-900">Describe your card</h2></div>
            <label className="block text-sm font-semibold text-slate-700" htmlFor="ai-card-prompt">Prompt</label>
            <textarea id="ai-card-prompt" rows={5} value={prompt} maxLength={1500} onChange={e=>setPrompt(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900 leading-relaxed focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
              placeholder="Describe names, date, place, colors and theme..."/>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs text-slate-500">{prompt.length}/1500 characters</span>
              <button type="button" onClick={()=>setPrompt(EXAMPLES[kind])} className="text-xs font-semibold text-blue-700 hover:underline">Use example prompt</button>
            </div>
            <div className="flex flex-wrap gap-3">
              <button type="button" onClick={createTemplate} className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white hover:bg-blue-700 focus-visible:ring-2 focus-visible:ring-blue-400">
                Create Free Template
              </button>
              <button type="button" disabled={!AI_READY||!turnstileToken||aiBusy} onClick={()=>void generateWithAi()}
                title={!AI_READY?'Gemini API and Turnstile must be connected first':undefined}
                className="flex items-center gap-2 rounded-xl border border-indigo-300 px-5 py-3 text-sm font-bold text-indigo-800 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-45">
                <Sparkles className="w-4 h-4"/>{aiBusy?'Generating…':'Generate with Gemini'}
              </button>
            </div>
            {AI_READY?<div className="space-y-2"><div ref={widgetRef}/><p className="text-xs text-slate-500">{turnstileStatus||'Complete free anti-bot verification to enable Gemini.'}</p></div>
            :<p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900 border border-amber-200">
              <Lock className="inline w-3.5 h-3.5 mr-1"/> Gemini API not connected yet. You can still create, edit and download real cards for free using local templates.
            </p>}
            {notice&&<p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800 flex gap-2"><CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5"/>{notice}</p>}
            {previewError&&<p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800 flex gap-2"><AlertCircle className="w-4 h-4 shrink-0 mt-0.5"/>{previewError}</p>}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-bold text-slate-900">Customize your design</h2>
              <button type="button" onClick={()=>setDraft(blankCard(kind))} className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-900"><RefreshCcw className="w-3 h-3"/> Reset</button>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={()=>setActivePanel('content')} aria-pressed={activePanel==='content'} className={`rounded-lg px-4 py-2 text-sm font-semibold ${activePanel==='content'?'bg-slate-900 text-white':'bg-slate-100 text-slate-600'}`}>Content</button>
              <button type="button" onClick={()=>setActivePanel('design')} aria-pressed={activePanel==='design'} className={`rounded-lg px-4 py-2 text-sm font-semibold ${activePanel==='design'?'bg-slate-900 text-white':'bg-slate-100 text-slate-600'}`}>Colors & Style</button>
            </div>
            {activePanel==='content'?<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {field('headline',kind==='visiting'?'Full name':kind==='wedding'?'Couple names':'Birthday person','Enter the main name')}
              {field('subheading',kind==='visiting'?'Designation':kind==='wedding'?'Invitation subtitle':'Celebration subtitle','Designer / Wedding celebration / Turning 10')}
              {kind==='visiting'&&field('organization','Business / Company','Business name')}
              {kind!=='visiting'&&<>{field('date','Event date','12 December 2027')}{field('time','Event time','7:00 PM')}{field('venue','Venue','Location and address')}{field('rsvp','RSVP','Phone or email')}</>}
              {kind==='visiting'&&<>{field('contact','Phone / WhatsApp','+92 ...')}{field('email','Email','contact@example.com')}{field('website','Website','example.com')}{field('venue','Address','City / address')}</>}
              <div className="sm:col-span-2">{field('message',kind==='visiting'?'Tagline':'Personal message','Your custom message',true)}</div>
            </div>:<div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">{PALETTES.map((palette)=><button type="button" key={palette.label}
                onClick={()=>setDraft(prev=>({...prev,primary:palette.primary,accent:palette.accent,background:palette.background}))}
                className="rounded-xl border border-slate-200 p-2 text-left text-xs font-medium hover:border-blue-400">
                <span className="mb-1 flex gap-0.5 overflow-hidden rounded-lg h-9">{[palette.background,palette.primary,palette.accent].map(c=><span key={c} className="flex-1" style={{backgroundColor:c}}/>)}</span>{palette.label}
              </button>)}</div>
              <div className="grid grid-cols-3 gap-2">{([['primary','Main text'],['accent','Accent'],['background','Paper']] as const).map(([key,label])=><label key={key} className="text-xs font-semibold text-slate-700 flex flex-col gap-1">{label}<input aria-label={label+' color'} type="color" value={draft[key]} onChange={e=>update(key,e.target.value)} className="w-full h-10 cursor-pointer"/></label>)}</div>
              <div className="grid grid-cols-2 gap-3">
                <label className="text-xs font-bold text-slate-700">Style<select value={draft.style} onChange={e=>update('style',e.target.value as CardStyle)} className="mt-1 block w-full rounded-xl border border-slate-300 p-2.5 text-sm font-normal"><option value="modern">Modern</option><option value="classic">Classic</option><option value="floral">Floral</option><option value="playful">Playful</option></select></label>
                <label className="text-xs font-bold text-slate-700">Font<select value={draft.font} onChange={e=>update('font',e.target.value as CardFont)} className="mt-1 block w-full rounded-xl border border-slate-300 p-2.5 text-sm font-normal"><option value="sans">Sans serif</option><option value="serif">Serif</option></select></label>
              </div>
              <input ref={uploadRef} type="file" accept="image/png,image/jpeg" className="hidden" onChange={e=>{const file=e.target.files?.[0];if(file)void handleLogo(file);e.target.value='';}}/>
              <div className="flex flex-wrap gap-2"><button type="button" onClick={()=>uploadRef.current?.click()} className="flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"><ImageIcon className="w-4 h-4"/> Add logo/photo</button>
                {draft.imageData&&<button type="button" onClick={()=>update('imageData','')} className="text-sm font-semibold text-red-700">Remove image</button>}</div>
            </div>}
          </section>
        </div>

        <section className="lg:sticky lg:top-20 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm space-y-4" aria-label="Live card preview">
          <div className="flex items-center justify-between gap-3">
            <div><h2 className="text-lg font-bold text-slate-900">Live card preview</h2><p className="text-xs text-slate-500 mt-1">{kind==='visiting'?'3.5 × 2 inches':'5 × 7 inches'} · {size.width} × {size.height} px</p></div>
            <Palette className="w-5 h-5 text-slate-400"/>
          </div>
          <div className="flex justify-center items-center rounded-2xl bg-slate-100 p-4 sm:p-6 min-h-[290px]">
            <canvas ref={canvasRef} aria-label="Preview of your editable card" role="img" className="max-w-full h-auto rounded-lg shadow-xl" style={{width:'100%'}}/>
          </div>
          <p className="text-xs text-slate-500">Preview and downloads use the same browser renderer. Check names, dates, spelling and print margins before sharing.</p>
          <div className="grid grid-cols-3 gap-2">{(['png','jpg','pdf'] as const).map(format=><button key={format} type="button" disabled={busy}
            onClick={()=>void download(format)} className="flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-2 py-3 text-xs sm:text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-50"><Download className="w-4 h-4"/>{format.toUpperCase()}</button>)}</div>
          <div className="rounded-xl bg-blue-50 p-3 text-xs leading-relaxed text-blue-900 flex gap-2"><ShieldCheck className="w-4 h-4 shrink-0 mt-0.5"/>
            The template rendering and files stay in your browser. When Gemini is enabled, only your prompt and a verification token are sent to the AI gateway—not your uploaded images.
          </div>
          {kind==='visiting'&&<p className="text-xs text-slate-600">Need a two-sided print card, QR or advanced controls? <a className="text-blue-700 underline font-semibold" href={import.meta.env.BASE_URL+'visiting-card-generator/'}>Open the existing Visiting Card Maker</a>.</p>}
        </section>
      </div>
    </div>
  </div>;
};
