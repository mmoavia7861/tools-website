import type { CardKind } from './aiCard';

export const ASSISTANT_PATHS = [
  '/ai-card-generator', '/wedding-card-maker', '/birthday-card-maker',
  '/visiting-card-generator', '/edit-pdf', '/compress-pdf', '/pdf-to-word',
  '/word-to-pdf', '/image-to-pdf', '/background-remover', '/qr-code-generator'
] as const;
export type AssistantPath = typeof ASSISTANT_PATHS[number];

export interface AssistantAdvice {
  reply: string;
  toolPath?: AssistantPath;
  actionLabel?: string;
  cardKind?: CardKind;
  cardPrompt?: string;
}

const CARD_ROUTES: Record<CardKind, AssistantPath> = {
  visiting: '/ai-card-generator',
  wedding: '/wedding-card-maker',
  birthday: '/birthday-card-maker'
};

export const QUICK_QUESTIONS = [
  'Visiting card kaise banayein?',
  'Wedding card design ideas',
  'Birthday invitation banao',
  'PDF edit aur sign kaise karein?',
  'PDF ko Word mein convert karo',
  'PDF file compress karni hai'
] as const;

const includesAny = (value: string, words: string[]) => words.some(word => value.includes(word));

export function makeCardPrompt(kind: CardKind, details = ''): string {
  const base: Record<CardKind, string> = {
    visiting: 'Create a clean modern blue and white visiting card. Name: [your name]. Title: [your job title]. Company: [company]. Phone: [number]. Email: [email]. Website: [website].',
    wedding: 'Create an elegant floral wedding invitation. Couple: [both names]. Date: [wedding date]. Time: [time]. Venue: [venue]. RSVP: [contact]. Use rose and cream colors.',
    birthday: 'Create a colorful birthday invitation with a playful design. Name: [celebrant]. Age: [age]. Date: [date]. Time: [time]. Venue: [venue]. RSVP: [contact].'
  };
  const cleaned = details.trim().replace(/[\u0000-\u001F\u007F]/g, ' ').slice(0, 480);
  return (cleaned && !/^(visiting card|wedding card|birthday card|birthday invitation|wedding invitation|.*kaise banayein\??|.*design ideas)$/i.test(cleaned)
    ? base[kind] + '\nUser details / preferences: ' + cleaned
    : base[kind]).slice(0, 1400);
}

export function isAssistantPath(value: unknown): value is AssistantPath {
  return typeof value === 'string' && (ASSISTANT_PATHS as readonly string[]).includes(value);
}

export function suggestTool(input: string): AssistantAdvice {
  const raw = input.trim().slice(0, 900);
  const s = raw.toLowerCase().replace(/[’]/g, "'");
  const card = (kind: CardKind, reply: string, actionLabel: string): AssistantAdvice => ({
    reply,
    toolPath: CARD_ROUTES[kind],
    actionLabel,
    cardKind: kind,
    cardPrompt: makeCardPrompt(kind, raw)
  });
  if (!s) return { reply: 'Aap visiting/wedding/birthday card ya PDF tool ke bare mein sawal pooch sakte hain. Neeche se ek suggestion choose karein.' };

  if (includesAny(s, ['wedding', 'shaadi', 'shadi', 'nikah', 'marriage', 'walima', 'mehndi', 'bride', 'groom'])) {
    return card('wedding', 'Wedding card ke liye couple ke names, date, time, venue aur RSVP likhein. Elegant floral/rose theme achhi rahegi. Main aapko editable prompt de raha hoon; details review karke PNG, JPG ya PDF download karein.', 'Wedding card banayein');
  }
  if (includesAny(s, ['birthday', 'bday', 'salgirah', 'janam din', 'janamdin', 'سالگرہ'])) {
    return card('birthday', 'Birthday invitation ke liye name, age, date, time, venue aur RSVP add karein. Colorful balloons/playful style choose kar sakte hain. Template editable hai aur PNG, JPG, PDF export available hai.', 'Birthday card banayein');
  }
  if (includesAny(s, ['visiting', 'business card', 'name card', 'contact card', 'professional card', 'business ka card'])) {
    return card('visiting', 'Professional visiting card ke liye name, job title, business, phone, email aur website likhein. Navy-blue/white minimalist style readable hoti hai. Prompt ready karke editable card maker khol sakte hain.', 'Visiting card banayein');
  }
  const pdf = includesAny(s, ['pdf', 'document', 'file', 'scan', 'signature', 'sign ', 'dastkhat', 'docx', 'word']);
  if (pdf && includesAny(s, ['word to pdf', 'word ko pdf', 'word se pdf', 'docx to pdf', 'docx ko pdf'])) {
    return { reply: 'Word to PDF: DOCX upload karein aur browser mein basic text PDF download karein. Complex layout, fonts aur kuch Unicode scripts preserve na bhi hon. Cloud conversion tabhi available hogi jab Adobe backend activate ho.', toolPath: '/word-to-pdf', actionLabel: 'Word to PDF kholein' };
  }
  if (pdf && includesAny(s, ['pdf to word', 'pdf ko word', 'pdf se word', 'pdf into word', 'pdf to docx', 'pdf edit in word', 'word mein'])) {
    return { reply: 'PDF to Word: Text-based PDF upload karein aur editable DOCX download karein. Scanned/photo PDFs mein OCR support nahi hai; tables aur complex layouts badal sakte hain. Adobe cloud mode alag se activate karna hota hai.', toolPath: '/pdf-to-word', actionLabel: 'PDF to Word kholein' };
  }
  if (pdf && includesAny(s, ['compress', 'reduce', 'small', 'smaller', 'chota', 'chhota', 'size', 'mb', 'kb', 'kam karo', 'ghata'])) {
    return { reply: 'PDF Compressor upload ke baad actual before/after file size dikhata hai. Har PDF chhoti nahi hoti, khaas kar pehle se optimized files. Download se pehle readability aur file size check karein.', toolPath: '/compress-pdf', actionLabel: 'PDF Compressor kholein' };
  }
  if (pdf && includesAny(s, ['edit', 'signature', 'sign', 'dastkhat', 'text add', 'write', 'likh', 'rotate', 'reorder', 'page number', 'watermark', 'fill'])) {
    return { reply: 'PDF Editor mein file upload karke text, signature, watermark aur page changes add kar sakte hain. Preview karein, phir edited PDF download karein. Yeh browser mein hota hai; agent aapki file khud read nahi karta.', toolPath: '/edit-pdf', actionLabel: 'PDF Editor kholein' };
  }
  if (includesAny(s, ['image to pdf', 'photo to pdf', 'jpg to pdf', 'png to pdf', 'image ko pdf', 'photo ko pdf', 'tasveer ko pdf'])) {
    return { reply: 'Image to PDF tool mein JPG, PNG ya WebP photos select karein, order aur page layout choose karein, phir ek PDF download karein.', toolPath: '/image-to-pdf', actionLabel: 'Image to PDF kholein' };
  }
  if (includesAny(s, ['background', 'bg remove', 'cutout', 'transparent image', 'photo ka background'])) {
    return { reply: 'Background Remover se image ka background hata kar transparent PNG export karein. Processing aapke browser/device par hoti hai aur device speed par depend karti hai.', toolPath: '/background-remover', actionLabel: 'Background Remover kholein' };
  }
  if (includesAny(s, ['qr code', 'qr generator', 'wifi qr', 'wi-fi qr'])) {
    return { reply: 'QR Generator mein URL, text, Wi-Fi ya contact details enter karein. QR code browser mein banta hai; PNG ya SVG download kar sakte hain.', toolPath: '/qr-code-generator', actionLabel: 'QR Generator kholein' };
  }
  if (pdf) {
    return { reply: 'PDF ke liye aap edit/sign, compress, PDF-to-Word, Word-to-PDF ya images-to-PDF use kar sakte hain. Bata dein aapko file ke saath kya karna hai. Agent files ko khud upload ya edit nahi karta.', toolPath: '/edit-pdf', actionLabel: 'PDF tools dekhein' };
  }
  if (includesAny(s, ['card', 'invitation', 'design', 'poster'])) {
    return { reply: 'ToolCresta par visiting, wedding aur birthday cards ke editable templates hain. Aap kis type ka card banana chahte hain? Name, date, venue aur color preferences bata dein.', toolPath: '/ai-card-generator', actionLabel: 'Card Maker kholein' };
  }
  return {
    reply: 'Main ToolCresta ke card aur PDF tools ke liye guide hoon. Misal: “wedding card banana hai”, “PDF ko Word mein badalna hai” ya “PDF par sign karna hai”. Main relevant tool aur steps suggest karunga. Local guide ke liye API key ki zaroorat nahi.',
    toolPath: '/ai-card-generator',
    actionLabel: 'Card tools dekhein'
  };
}
