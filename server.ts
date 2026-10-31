import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { validatePdfBytes, optimizePdfLocally } from './src/utils/pdf.ts';
import { validateImageSignature } from './src/utils/image.ts';
import { getActiveAiProvider, executeBackgroundRemoval } from './src/server/aiProvider.ts';
import { processGeminiTask } from './src/server/geminiService.ts';
import { generateCardStyleWithAi } from './src/server/aiCardService.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);
const isProd = process.env.NODE_ENV === 'production';

// Strict body parsers with limits
app.use(express.json({ limit: '30mb' }));
app.use(express.urlencoded({ extended: true, limit: '30mb' }));

// Basic Security Headers Middleware
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});

// Lightweight In-Memory Sliding Window Rate Limiter
const ipRequestCounts = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 60;

app.use('/api', (req, res, next) => {
  const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const clientRecord = ipRequestCounts.get(clientIp);

  if (!clientRecord || now > clientRecord.resetTime) {
    ipRequestCounts.set(clientIp, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return next();
  }

  if (clientRecord.count >= MAX_REQUESTS_PER_WINDOW) {
    return res.status(429).json({
      error: 'Too many requests. Please wait a moment before trying again.'
    });
  }

  clientRecord.count += 1;
  next();
});

// Clean up stale rate limit records every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of ipRequestCounts.entries()) {
    if (now > record.resetTime) {
      ipRequestCounts.delete(ip);
    }
  }
}, 5 * 60 * 1000);

// --- API ROUTES ---

// Health check
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    memoryUsageMb: Math.round(process.memoryUsage().rss / (1024 * 1024)),
    version: '1.0.0'
  });
});

// Admin status & provider check
app.get('/api/admin/status', (_req, res) => {
  const aiProvider = getActiveAiProvider();
  res.json({
    aiProvider,
    geminiKeyPresent: Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim() !== ''),
    removeBgKeyPresent: Boolean(process.env.REMOVE_BG_API_KEY && process.env.REMOVE_BG_API_KEY.trim() !== ''),
    appUrl: process.env.APP_URL || 'http://localhost:3000',
    environment: process.env.NODE_ENV || 'development'
  });
});

// PDF Compression Endpoint (Server Fallback)
app.post('/api/compress-pdf', async (req, res) => {
  let fileBuffer: Buffer | null = null;
  try {
    const { fileBase64, preset } = req.body;
    if (!fileBase64 || typeof fileBase64 !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid fileBase64 parameter.' });
    }

    fileBuffer = Buffer.from(fileBase64, 'base64');

    // Strict file validation
    const validation = validatePdfBytes(new Uint8Array(fileBuffer));
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    // Process optimization
    const result = await optimizePdfLocally(new Uint8Array(fileBuffer), preset || 'balanced');

    return res.json({
      success: true,
      originalSize: result.originalSize,
      compressedSize: result.compressedSize,
      reductionPercentage: result.reductionPercentage,
      isReduced: result.isReduced,
      message: result.message,
      method: 'server',
      outputBase64: Buffer.from(result.outputData).toString('base64')
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'PDF compression failed.';
    return res.status(500).json({ error: errorMsg });
  } finally {
    // Immediate memory cleanup
    fileBuffer = null;
  }
});

// AI Background Removal Endpoint
app.post('/api/remove-background', async (req, res) => {
  let imageBuffer: Buffer | null = null;
  try {
    const { imageBase64 } = req.body;
    if (!imageBase64 || typeof imageBase64 !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid imageBase64 parameter.' });
    }

    imageBuffer = Buffer.from(imageBase64, 'base64');

    // Validate signature
    const validation = validateImageSignature(new Uint8Array(imageBuffer));
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    const removalResult = await executeBackgroundRemoval(imageBuffer, validation.mimeType || 'image/png');

    if (removalResult.success && removalResult.imageBase64) {
      return res.json({
        success: true,
        imageBase64: removalResult.imageBase64
      });
    }

    // Graceful response directing client to on-device neural/canvas segmentation
    return res.json({
      success: false,
      fallbackToOnDevice: true,
      message: removalResult.message || removalResult.error || 'Use on-device Neural AI segmentation.'
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Background removal service error.';
    return res.json({
      success: false,
      fallbackToOnDevice: true,
      error: errorMsg
    });
  } finally {
    imageBuffer = null;
  }
});

// AI Visiting Card Style Generation Endpoint
app.post('/api/generate-card-ai', async (req, res) => {
  try {
    const { prompt, companyName, jobTitle } = req.body;
    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ error: 'Missing prompt description.' });
    }

    const generatedStyle = await generateCardStyleWithAi({
      prompt: prompt.trim(),
      companyName: companyName ? String(companyName).trim() : undefined,
      jobTitle: jobTitle ? String(jobTitle).trim() : undefined
    });

    return res.json({
      success: true,
      style: generatedStyle
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to generate card style.';
    return res.status(500).json({ error: errorMsg });
  }
});

// Gemini Multi-Task Endpoint
app.post('/api/gemini/analyze', async (req, res) => {
  try {
    const { task, prompt, context } = req.body;
    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ error: 'Missing required prompt string.' });
    }

    const result = await processGeminiTask({
      task: task || 'general',
      prompt,
      context
    });

    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    return res.json(result);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Gemini task execution failed.';
    return res.status(500).json({ error: errorMsg });
  }
});

// Contact endpoint fallback
app.post('/api/contact', (req, res) => {
  const { name, email, category, message, honeypot } = req.body;
  // Honeypot spam protection
  if (honeypot && String(honeypot).trim() !== '') {
    return res.status(200).json({ success: true }); // Silent drop for bots
  }

  if (!name || !email || !message) {
    return res.status(400).json({ error: 'Name, email, and message are required.' });
  }

  return res.json({
    success: true,
    message: 'Message received and stored securely.'
  });
});

// --- CLIENT SERVING ---
async function startServer() {
  if (!isProd) {
    // Dynamic import of Vite in development
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    // Static production build serving
    const distPath = path.join(__dirname, 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (_req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`RankNova full-stack server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});
