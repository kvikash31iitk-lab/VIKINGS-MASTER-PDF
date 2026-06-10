/**
 * AI provider abstraction. Three built-ins ship with the app:
 *  - offline   : deterministic extractive engine (no network)
 *  - ollama    : local Ollama server (/api/chat, NDJSON streaming)
 *  - openai    : any OpenAI-compatible endpoint (/v1/chat/completions, SSE)
 * Plugins can register additional providers through the Plugin SDK.
 */

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatRequestOptions {
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
  onChunk?: (text: string) => void;
}

export interface AiProviderInfo {
  id: string;
  label: string;
  requiresNetwork: boolean;
}

export interface AiProvider {
  readonly info: AiProviderInfo;
  chat(messages: ChatMessage[], options?: ChatRequestOptions): Promise<string>;
}

export type AiAction = 'summarize' | 'keypoints' | 'actions' | 'faq' | 'chat';

// ───────────────────────── HTTP payload builders ─────────────────────────
// Kept here (pure) so both the renderer service and tests share them; the
// actual network call goes through the main-process proxy.

export interface OllamaConfig {
  baseUrl: string;
  model: string;
}

export function buildOllamaRequest(
  config: OllamaConfig,
  messages: ChatMessage[],
  options?: ChatRequestOptions
): { url: string; body: string } {
  return {
    url: `${config.baseUrl.replace(/\/$/, '')}/api/chat`,
    body: JSON.stringify({
      model: config.model,
      messages,
      stream: true,
      options: {
        ...(options?.temperature !== undefined ? { temperature: options.temperature } : {}),
        ...(options?.maxTokens !== undefined ? { num_predict: options.maxTokens } : {})
      }
    })
  };
}

/** Parses one NDJSON line from Ollama streaming output. */
export function parseOllamaLine(line: string): { content: string; done: boolean } | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  try {
    const obj = JSON.parse(trimmed) as { message?: { content?: string }; done?: boolean };
    return { content: obj.message?.content ?? '', done: obj.done === true };
  } catch {
    return null;
  }
}

export interface OpenAiConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

export function buildOpenAiRequest(
  config: OpenAiConfig,
  messages: ChatMessage[],
  options?: ChatRequestOptions
): { url: string; headers: Record<string, string>; body: string } {
  return {
    url: `${config.baseUrl.replace(/\/$/, '')}/v1/chat/completions`,
    headers: {
      'Content-Type': 'application/json',
      ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {})
    },
    body: JSON.stringify({
      model: config.model,
      messages,
      stream: true,
      ...(options?.temperature !== undefined ? { temperature: options.temperature } : {}),
      ...(options?.maxTokens !== undefined ? { max_tokens: options.maxTokens } : {})
    })
  };
}

/** Parses one SSE line ("data: {...}") from OpenAI-compatible streaming. */
export function parseOpenAiSseLine(line: string): { content: string; done: boolean } | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith('data:')) return null;
  const payload = trimmed.slice(5).trim();
  if (payload === '[DONE]') return { content: '', done: true };
  try {
    const obj = JSON.parse(payload) as {
      choices?: Array<{ delta?: { content?: string }; finish_reason?: string | null }>;
    };
    const choice = obj.choices?.[0];
    return {
      content: choice?.delta?.content ?? '',
      done: choice?.finish_reason != null
    };
  } catch {
    return null;
  }
}

// ───────────────────────── Prompt templates ─────────────────────────

export function buildActionPrompt(action: AiAction, documentText: string, userQuestion?: string): ChatMessage[] {
  const docBlock = truncateForContext(documentText, 24000);
  const system: ChatMessage = {
    role: 'system',
    content:
      'You are the document assistant inside Vikings Master PDF. Ground every answer ' +
      'strictly in the provided document text. When you reference content, cite the page ' +
      'like (p. 3). If the document does not contain the answer, say so.'
  };
  const prompts: Record<AiAction, string> = {
    summarize: 'Summarize this document in a concise, well-structured way (max ~250 words).',
    keypoints: 'Extract the key points of this document as a bulleted list (max 12 bullets).',
    actions: 'Extract all action items, obligations and deadlines from this document as a checklist.',
    faq: 'Generate 6-10 frequently-asked questions with short answers based on this document.',
    chat: userQuestion ?? 'Answer questions about this document.'
  };
  return [
    system,
    {
      role: 'user',
      content: `DOCUMENT:\n"""\n${docBlock}\n"""\n\nTASK: ${prompts[action]}`
    }
  ];
}

export function truncateForContext(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  const head = text.slice(0, Math.floor(maxChars * 0.7));
  const tail = text.slice(-Math.floor(maxChars * 0.25));
  return `${head}\n…[content truncated]…\n${tail}`;
}
