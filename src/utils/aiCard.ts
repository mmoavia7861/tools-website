import { PDFDocument } from 'pdf-lib';

export type CardKind = 'visiting' | 'wedding' | 'birthday';
export type CardStyle = 'modern' | 'classic' | 'floral' | 'playful';
export type CardFont = 'sans' | 'serif';

export interface CardDraft {
  kind: CardKind;
  headline: string;
  subheading: string;
  organization: string;
  message: string;
  date: string;
  time: string;
  venue: string;
  contact: string;
  email: string;
  website: string;
  rsvp: string;
  primary: string;
  accent: string;
  background: string;
  style: CardStyle;
  font: CardFont;
  imageData: string;
}

export const EXAMPLES: Record<CardKind, string> = {
  visiting: 'Make a modern blue and white visiting card. Name: Aisha Khan. Title: Graphic Designer. Company: Creative Studio. Phone: +92 300 1234567. Email: aisha@example.com. Website: example.com.',
  wedding: 'Create an elegant floral wedding invitation for Ali and Ayesha. Date: 12 December 2027. Time: 7 PM. Venue: Rose Garden Hall, Islamabad. RSVP: +92 300 1234567.',
  birthday: "Design a colorful birthday invitation for Sara's 10th birthday, with balloons. Date: 5 January 2027. Time: 4 PM. Venue: Family Garden. RSVP: +92 300 1234567."
};

export const PALETTES = [
  { label: 'Royal Navy', primary: '#11264B', accent: '#D4AE69', background: '#F8F5EF' },
  { label: 'Rose Garden', primary: '#6C284A', accent: '#C78C96', background: '#FFF5F7' },
  { label: 'Modern Blue', primary: '#123D78', accent: '#3A94EA', background: '#EFF7FF' },
  { label: 'Forest Green', primary: '#204D3C', accent: '#A4BE92', background: '#F1F7EF' },
  { label: 'Birthday Pop', primary: '#4A2688', accent: '#FB7B67', background: '#FFF8EF' }
] as const;

const clean = (text: unknown, max = 130): string =>
  typeof text === 'string' ? text.replace(/[\u0000-\u001F\u007F]/g, ' ').trim().slice(0, max) : '';

const HEX = /^#[0-9A-Fa-f]{6}$/;
const color = (value: unknown, fallback: string) => typeof value === 'string' && HEX.test(value) ? value : fallback;

export function blankCard(kind: CardKind): CardDraft {
  const palette = kind === 'wedding' ? PALETTES[1] : kind === 'birthday' ? PALETTES[4] : PALETTES[2];
  return {
    kind, headline: '', subheading: '', organization: '', message: '', date: '', time: '',
    venue: '', contact: '', email: '', website: '', rsvp: '',
    primary: palette.primary, accent: palette.accent, background: palette.background,
    style: kind === 'wedding' ? 'floral' : kind === 'birthday' ? 'playful' : 'modern',
    font: kind === 'wedding' ? 'serif' : 'sans', imageData: ''
  };
}

export function sanitizeCardDraft(payload: unknown, kind: CardKind): CardDraft {
  const data = payload && typeof payload === 'object' && !Array.isArray(payload) ? payload as Record<string, unknown> : {};
  const base = blankCard(kind);
  return {
    ...base,
    headline: clean(data.headline, 90), subheading: clean(data.subheading, 110),
    organization: clean(data.organization, 90), message: clean(data.message, 180),
    date: clean(data.date, 60), time: clean(data.time, 60), venue: clean(data.venue, 120),
    contact: clean(data.contact, 90), email: clean(data.email, 110), website: clean(data.website, 100),
    rsvp: clean(data.rsvp, 110),
    primary: color(data.primary, base.primary), accent: color(data.accent, base.accent),
    background: color(data.background, base.background),
    style: (['modern','classic','floral','playful'] as string[]).includes(String(data.style)) ? data.style as CardStyle : base.style,
    font: data.font === 'serif' ? 'serif' : data.font === 'sans' ? 'sans' : base.font,
    imageData: ''
  };
}

function capture(prompt: string, names: string[]): string {
  for (const name of names) {
    const regex = new RegExp('(?:^|[\\n.;])\\s*' + name + '\\s*[:=]\\s*([^\\n;]+)', 'i');
    const match = prompt.match(regex);
    if (match) return clean(match[1], 110).replace(/\.$/, '');
  }
  return '';
}

/** Deterministic local template helper, explicitly NOT Gemini or AI. */
export function draftFromPrompt(kind: CardKind, promptInput: string): CardDraft {
  const prompt = promptInput.slice(0, 2000);
  const base = blankCard(kind);
  const lower = prompt.toLowerCase();
  const palette = /gold|royal|luxury|black/.test(lower) ? PALETTES[0]
    : /pink|rose|floral/.test(lower) ? PALETTES[1]
    : /green|nature|forest/.test(lower) ? PALETTES[3]
    : /colorful|party|balloon|rainbow|fun/.test(lower) ? PALETTES[4]
    : PALETTES[2];
  const matchedNames = kind === 'wedding' ? prompt.match(/(?:for|of)\s+([\p{L} .'-]{2,40}?)\s+(?:and|&)\s+([\p{L} .'-]{2,40}?)(?=[.,\n]| on\b| at\b| date\b|$)/iu)
    : kind === 'birthday' ? prompt.match(/(?:for|of)\s+([\p{L} .'-]{2,50}?)(?:['’]s)?\s+\d*(?:st|nd|rd|th)?\s*birthday/iu)
    : null;
  const headline = capture(prompt, kind === 'visiting' ? ['name', 'full name'] : kind === 'wedding' ? ['couple', 'names', 'bride and groom'] : ['name', 'birthday person', 'celebrant'])
    || (matchedNames ? kind === 'wedding' ? clean(matchedNames[1] + ' & ' + matchedNames[2]) : clean(matchedNames[1]) : '');
  const email = capture(prompt, ['email']) || (prompt.match(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/)?.[0] || '');
  const phone = capture(prompt, ['phone', 'mobile', 'whatsapp', 'contact']);
  const website = capture(prompt, ['website', 'web']);
  const eventDate = capture(prompt, ['date']);
  const eventTime = capture(prompt, ['time']);
  const eventVenue = capture(prompt, ['venue', 'location', 'address']);
  const rsvp = capture(prompt, ['rsvp']);
  const title = capture(prompt, ['title', 'job', 'designation', 'role']);
  return {
    ...base,
    headline,
    subheading: title || capture(prompt, ['subtitle', 'heading']),
    organization: capture(prompt, ['company', 'business', 'organization']),
    message: capture(prompt, ['message', 'tagline', 'details']),
    date: eventDate, time: eventTime, venue: eventVenue,
    contact: phone, email, website, rsvp,
    primary: palette.primary, accent: palette.accent, background: palette.background,
    style: /floral|flower/.test(lower) ? 'floral' : /classic|elegant|royal/.test(lower) ? 'classic' : /balloon|cartoon|colorful|party/.test(lower) ? 'playful' : base.style,
    font: /serif|classic|royal|elegant/.test(lower) ? 'serif' : base.font
  };
}

export function cardSize(kind: CardKind): { width: number; height: number; pdfWidth: number; pdfHeight: number } {
  return kind === 'visiting'
    ? { width: 1050, height: 600, pdfWidth: 252, pdfHeight: 144 }
    : { width: 1200, height: 1680, pdfWidth: 360, pdfHeight: 504 };
}

function lineWrap(ctx: CanvasRenderingContext2D, text: string, width: number, maxLines = 3): string[] {
  const lines: string[] = [];
  let current = '';
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = current ? current + ' ' + word : word;
    if (current && ctx.measureText(next).width > width) { lines.push(current); current = word; }
    else current = next;
    if (lines.length >= maxLines) break;
  }
  if (current && lines.length < maxLines) lines.push(current);
  return lines;
}
function multiline(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, width: number, lineHeight: number, maxLines = 2) {
  if (!text) return;
  for (const line of lineWrap(ctx, text, width, maxLines)) {
    ctx.fillText(line, x, y);
    y += lineHeight;
  }
}
function ellipse(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, rotation: number) {
  ctx.beginPath(); ctx.ellipse(x, y, w, h, rotation, 0, Math.PI * 2); ctx.fill();
}
export function drawCardCanvas(canvas: HTMLCanvasElement, draft: CardDraft, image: HTMLImageElement | null = null) {
  const dims = cardSize(draft.kind);
  canvas.width = dims.width; canvas.height = dims.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas rendering not supported by this browser.');
  const { width: w, height: h } = dims;
  const primary = color(draft.primary, '#123D78');
  const accent = color(draft.accent, '#3A94EA');
  const bg = color(draft.background, '#EFF7FF');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
  ctx.save();
  // Abstract, print-safe vector decorations, not AI-generated imagery.
  if (draft.style === 'playful') {
    const positions = [[125, 140, 36], [w-140, 200, 46], [180, h-230, 25], [w-175, h-300, 33]];
    positions.forEach(([x,y,r], i) => {
      ctx.globalAlpha = 0.38; ctx.fillStyle = i % 2 ? primary : accent;
      ellipse(ctx, x, y, r, r * 1.25, 0);
      ctx.strokeStyle = accent; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x,y+r); ctx.lineTo(x+8,y+r+85); ctx.stroke();
    });
  } else if (draft.style === 'floral') {
    ctx.globalAlpha = 0.23; ctx.fillStyle = accent;
    for (const [cx,cy] of [[160,180],[w-165,175],[150,h-185],[w-150,h-175]]) {
      for (let i=0;i<7;i++) {
        const t = i * (Math.PI*2/7);
        ellipse(ctx,cx+Math.cos(t)*43,cy+Math.sin(t)*43,27,51,t);
      }
      ellipse(ctx,cx,cy,24,24,0);
    }
  } else {
    const gradient = ctx.createLinearGradient(0,0,w,h);
    gradient.addColorStop(0,primary);gradient.addColorStop(1,accent);
    ctx.fillStyle=gradient;ctx.globalAlpha=draft.style === 'classic' ? 0.09 : 0.15;
    ellipse(ctx,w+90,0,w*0.42,h*0.85,-0.5);
    ellipse(ctx,-50,h,w*0.27,h*0.72,-0.6);
  }
  ctx.restore();
  ctx.strokeStyle = accent;ctx.lineWidth = draft.kind === 'visiting' ? 5 : 6;
  ctx.strokeRect(draft.kind === 'visiting' ? 28 : 55,draft.kind === 'visiting' ? 28 : 65,w-(draft.kind === 'visiting' ? 56 : 110),h-(draft.kind === 'visiting' ? 56 : 130));
  ctx.fillStyle = accent;
  const family = draft.font === 'serif' ? 'Georgia, "Times New Roman", serif' : 'Arial, "Helvetica Neue", sans-serif';
  if (draft.kind === 'visiting') {
    ctx.textAlign='left';
    ctx.font = '600 27px Arial, sans-serif';ctx.fillStyle=accent;ctx.fillText((draft.organization || 'YOUR BUSINESS').slice(0,60).toUpperCase(),75,130,720);
    ctx.font = 'bold 72px ' + family;ctx.fillStyle=primary;ctx.fillText(draft.headline || 'Your Name',75,260,850);
    ctx.font = '32px ' + family;ctx.fillStyle=primary;ctx.fillText(draft.subheading || 'Your profession',77,325,770);
    ctx.strokeStyle=accent;ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(77,358);ctx.lineTo(350,358);ctx.stroke();
    ctx.font = '24px Arial, sans-serif';ctx.fillStyle=primary;
    const items = [draft.contact,draft.email,draft.website,draft.venue].filter(Boolean);
    items.slice(0,4).forEach((txt,i)=>ctx.fillText(txt,78,412+i*38,820));
    if(!items.length) ctx.fillText('Phone  ·  Email  ·  Website',78,430,800);
    if(draft.message) {ctx.textAlign='right';ctx.font='italic 22px '+family;ctx.fillText(draft.message,w-62,h-64,550);}
  } else {
    ctx.textAlign='center';ctx.fillStyle=accent;
    ctx.font='600 29px Arial, sans-serif';
    ctx.fillText(draft.kind==='wedding'?'THE WEDDING INVITATION':'YOU ARE INVITED',w/2,235,750);
    ctx.font='normal 42px '+family;ctx.fillStyle=primary;
    ctx.fillText(draft.kind==='wedding'?'Together with our families':'Let’s Celebrate!',w/2,355,900);
    ctx.font='bold 86px '+family;
    multiline(ctx,draft.headline||'Your Name',w/2,585,960,95,2);
    ctx.font='34px '+family;ctx.fillStyle=primary;
    multiline(ctx,draft.subheading || (draft.kind === 'wedding'?'A celebration of love':'Birthday Party'),w/2,735,900,47,2);
    ctx.strokeStyle=accent;ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(350,820);ctx.lineTo(w-350,820);ctx.stroke();
    ctx.font='bold 39px '+family;
    multiline(ctx,draft.date||'Event Date',w/2,928,880,50,2);
    ctx.font='32px '+family;
    if(draft.time)ctx.fillText(draft.time,w/2,1010,880);
    multiline(ctx,draft.venue||'Your Venue',w/2,1125,880,45,3);
    if(draft.message){ctx.font='italic 29px '+family;multiline(ctx,draft.message,w/2,1320,900,42,2);}
    if(draft.rsvp || draft.contact){ctx.font='26px Arial, sans-serif';ctx.fillText('RSVP: '+(draft.rsvp||draft.contact),w/2,h-185,920);}
  }
  if (image) {
    const size = draft.kind==='visiting' ? 115 : 170;
    const x = draft.kind==='visiting' ? w-size-68 : (w-size)/2;
    const y = draft.kind==='visiting' ? 70 : 50;
    ctx.save();ctx.beginPath();ctx.roundRect(x,y,size,size,18);ctx.clip();
    ctx.fillStyle='#ffffff';ctx.fillRect(x,y,size,size);
    const scale=Math.min(size/image.width,size/image.height);
    ctx.drawImage(image,x+(size-image.width*scale)/2,y+(size-image.height*scale)/2,image.width*scale,image.height*scale);
    ctx.restore();
  }
}

export async function exportCardFile(canvas: HTMLCanvasElement, draft: CardDraft, format: 'png'|'jpg'|'pdf'): Promise<Blob> {
  if (format === 'pdf') {
    const png = await new Promise<Blob>((resolve,reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error('PNG export failed')), 'image/png'));
    const bytes = await png.arrayBuffer();
    const doc = await PDFDocument.create();
    const embedded = await doc.embedPng(bytes);
    const dims = cardSize(draft.kind);
    const page = doc.addPage([dims.pdfWidth, dims.pdfHeight]);
    page.drawImage(embedded,{x:0,y:0,width:dims.pdfWidth,height:dims.pdfHeight});
    const output=await doc.save();
    return new Blob([new Uint8Array(output)],{type:'application/pdf'});
  }
  return new Promise<Blob>((resolve,reject)=>{
    canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('Image export failed')),format==='jpg'?'image/jpeg':'image/png',0.95);
  });
}
