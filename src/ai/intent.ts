import { SmartContextConfig } from '../config/index.js';
import { safeFetch } from '../utils/fetch.js';

export interface IntentAnalysisResult {
  keywords: string[];
  suggestedFiles: string[];
  summary: string;
}

export async function analyzeIntent(prompt: string, config: SmartContextConfig): Promise<IntentAnalysisResult> {
  const words = prompt
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2);

  const defaultResult: IntentAnalysisResult = {
    keywords: Array.from(new Set(words)),
    suggestedFiles: [],
    summary: prompt,
  };

  if (!config.lowAiBaseUrl) {
    return defaultResult;
  }

  const baseUrl = config.lowAiBaseUrl.replace(/\/$/, '');
  const provider = config.lowAiProvider.toLowerCase();

  try {
    // Case 1: Anthropic API Format (or Ollama Anthropic Compatible Proxy)
    if (provider.includes('anthropic') || provider.includes('ollama')) {
      const endpoint = baseUrl.endsWith('/v1/messages') ? baseUrl : `${baseUrl}/v1/messages`;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      
      if (config.lowAiAuthToken) {
        headers['Authorization'] = `Bearer ${config.lowAiAuthToken}`;
      }
      if (config.lowAiApiKey) {
        headers['x-api-key'] = config.lowAiApiKey;
      } else {
        headers['x-api-key'] = 'ollama';
      }

      const response = await safeFetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: config.lowAiModel,
          max_tokens: 300,
          messages: [
            {
              role: 'user',
              content: `Phân tích câu hỏi lập trình sau và tóm tắt ngắn gọn trong 1 câu: "${prompt}"`,
            },
          ],
        }),
      });

      if (response.ok) {
        const data = await response.json() as any;
        const text = data?.content?.[0]?.text || '';
        if (text) defaultResult.summary = text.trim();
      }
    } 
    // Case 2: OpenAI Compatible Format (Groq, OpenAI, LocalAI)
    else if (provider.includes('openai') || provider.includes('groq')) {
      const endpoint = baseUrl.endsWith('/v1/chat/completions') ? baseUrl : `${baseUrl}/v1/chat/completions`;
      const response = await safeFetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.lowAiApiKey}`,
        },
        body: JSON.stringify({
          model: config.lowAiModel,
          max_tokens: 300,
          messages: [
            {
              role: 'user',
              content: `Phân tích câu hỏi lập trình sau và tóm tắt ngắn gọn trong 1 câu: "${prompt}"`,
            },
          ],
        }),
      });

      if (response.ok) {
        const data = await response.json() as any;
        const text = data?.choices?.[0]?.message?.content || '';
        if (text) defaultResult.summary = text.trim();
      }
    }
  } catch (err) {
    console.error('[IntentAnalyzer] Low AI request skipped (offline/fallback mode).');
  }

  return defaultResult;
}
