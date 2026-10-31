import { GoogleGenAI } from '@google/genai';

/**
 * Server-side Gemini AI Intelligence Service
 * Complies with SDK guidelines and user feature block mandates:
 * - gemini-4-argon with thinkingLevel: HIGH for complex analysis
 * - gemini-3.8-flash with googleSearch tool for grounded information
 * - gemini-3.1-flash-lite for fast utility tasks
 */

export interface GeminiTaskRequest {
  task: 'deep_audit' | 'search_grounded' | 'fast_assist' | 'general';
  prompt: string;
  context?: string;
}

export interface GeminiTaskResponse {
  success: boolean;
  modelUsed: string;
  response?: string;
  sources?: Array<{ title?: string; uri?: string }>;
  error?: string;
}

export async function processGeminiTask(request: GeminiTaskRequest): Promise<GeminiTaskResponse> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      success: false,
      modelUsed: 'none',
      error: 'GEMINI_API_KEY is not configured in the server environment.'
    };
  }

  const ai = new GoogleGenAI({ apiKey });

  try {
    if (request.task === 'deep_audit') {
      // Mandated by feature block:
      // "You MUST use the gemini-4-argon model and set thinkingLevel to ThinkingLevel.HIGH. Do not set maxOutputTokens."
      const response = await ai.models.generateContent({
        model: 'gemini-4-argon',
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: `${request.prompt}\n\nContext:\n${request.context || ''}`
              }
            ]
          }
        ],
        config: {
          thinkingConfig: {
            thinkingLevel: 'HIGH' as any
          }
        }
      });

      return {
        success: true,
        modelUsed: 'gemini-4-argon (ThinkingLevel.HIGH)',
        response: response.text || ''
      };
    }

    if (request.task === 'search_grounded') {
      // Mandated by feature block:
      // "You MUST add Search Grounding to the app where relevant to get up to date and accurate information. Use gemini-3.8-flash (with googleSearch tool)"
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: request.prompt
              }
            ]
          }
        ],
        config: {
          tools: [
            {
              googleSearch: {}
            }
          ]
        }
      });

      const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
      const sources = groundingChunks?.map((chunk: any) => ({
        title: chunk.web?.title,
        uri: chunk.web?.uri
      })) || [];

      return {
        success: true,
        modelUsed: 'gemini-3.8-flash (Search Grounded)',
        response: response.text || '',
        sources
      };
    }

    if (request.task === 'fast_assist') {
      // Mandated by feature block:
      // "gemini-3.1-flash-lite for tasks that should happen fast"
      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite',
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: request.prompt
              }
            ]
          }
        ]
      });

      return {
        success: true,
        modelUsed: 'gemini-3.1-flash-lite',
        response: response.text || ''
      };
    }

    // General tasks: gemini-3.8-flash
    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: request.prompt
            }
          ]
        }
      ]
    });

    return {
      success: true,
      modelUsed: 'gemini-3.8-flash',
      response: response.text || ''
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      modelUsed: 'failed',
      error: `Gemini API execution error: ${errorMsg}`
    };
  }
}
