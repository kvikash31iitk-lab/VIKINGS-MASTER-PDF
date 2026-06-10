/**
 * AI assistant service — provider selection (offline engine, Ollama,
 * OpenAI-compatible), streaming through the main-process proxy, grounded
 * document actions, and history persistence.
 */
import {
  buildOllamaRequest,
  buildOpenAiRequest,
  parseOllamaLine,
  parseOpenAiSseLine,
  buildActionPrompt,
  type AiAction,
  type ChatMessage
} from '@core/ai/provider';
import { summarize, keyPoints, actionItems, generateFaq, answerQuestion } from '@core/ai/offline-engine';
import { documentService } from './document-service';
import { ipc } from './ipc';
import { useAiStore, toast } from '../stores/ui-stores';
import { useSettingsStore } from '../stores/settings-store';
import { useDocumentsStore } from '../stores/documents-store';
import { uid } from '../utils';
import type { AiProxyChunk } from '@shared/types';

type StreamParser = (line: string) => { content: string; done: boolean } | null;

const pendingStreams = new Map<
  string,
  { docKey: string; messageId: string; parser: StreamParser; buffer: string; full: string; action: AiAction; prompt: string }
>();

ipc.ai.onChunk((chunk: AiProxyChunk) => {
  const stream = pendingStreams.get(chunk.requestId);
  if (!stream) return;
  const store = useAiStore.getState();

  if (chunk.kind === 'error') {
    store.patchMessage(stream.docKey, stream.messageId, {
      content: `⚠ ${chunk.error ?? 'Provider request failed'}`,
      streaming: false
    });
    store.setBusy(false);
    pendingStreams.delete(chunk.requestId);
    return;
  }
  if (chunk.kind === 'chunk' && chunk.data) {
    stream.buffer += chunk.data;
    const lines = stream.buffer.split('\n');
    stream.buffer = lines.pop() ?? '';
    for (const line of lines) {
      const parsed = stream.parser(line);
      if (parsed?.content) {
        stream.full += parsed.content;
        store.appendToMessage(stream.docKey, stream.messageId, parsed.content);
      }
    }
  }
  if (chunk.kind === 'done') {
    const tail = stream.parser(stream.buffer);
    if (tail?.content) {
      stream.full += tail.content;
      store.appendToMessage(stream.docKey, stream.messageId, tail.content);
    }
    store.patchMessage(stream.docKey, stream.messageId, { streaming: false });
    store.setBusy(false);
    persistHistory(stream.action, stream.prompt, stream.full);
    pendingStreams.delete(chunk.requestId);
  }
});

function persistHistory(action: AiAction, prompt: string, response: string): void {
  const settings = useSettingsStore.getState().settings.ai;
  if (!settings.storeHistory || !response) return;
  const meta = useDocumentsStore.getState().docs.find(
    (d) => d.id === useDocumentsStore.getState().activeId
  );
  void ipc.history.addAi({
    ...(meta?.path ? { docPath: meta.path } : {}),
    provider: settings.provider,
    action,
    prompt: prompt.slice(0, 2000),
    response: response.slice(0, 20000)
  });
}

async function documentPages(docId: string): Promise<Array<{ pageIndex: number; text: string }>> {
  return documentService.allPagesText(docId);
}

export const aiService = {
  /** Runs an assistant action; answer streams into the conversation. */
  async runAction(docId: string, action: AiAction, userQuestion?: string): Promise<void> {
    const store = useAiStore.getState();
    if (store.busy) {
      toast.warning('Assistant is busy');
      return;
    }
    const settings = useSettingsStore.getState().settings.ai;
    const docKey = docId;

    const labels: Record<AiAction, string> = {
      summarize: 'Summarize this document',
      keypoints: 'Extract key points',
      actions: 'Extract action items',
      faq: 'Generate FAQs',
      chat: userQuestion ?? ''
    };
    store.append(docKey, { id: uid('msg'), role: 'user', content: labels[action] });
    const assistantId = uid('msg');
    store.append(docKey, { id: assistantId, role: 'assistant', content: '', streaming: true });
    store.setBusy(true);

    const pages = await documentPages(docId);

    // ── Offline engine: deterministic, instant, no network ──
    if (settings.provider === 'offline') {
      let result: string;
      switch (action) {
        case 'summarize':
          result = summarize(pages);
          break;
        case 'keypoints':
          result = keyPoints(pages);
          break;
        case 'actions':
          result = actionItems(pages);
          break;
        case 'faq':
          result = generateFaq(pages);
          break;
        case 'chat':
          result = answerQuestion(pages, userQuestion ?? '');
          break;
      }
      store.patchMessage(docKey, assistantId, { content: result, streaming: false });
      store.setBusy(false);
      persistHistory(action, labels[action], result);
      return;
    }

    // ── Remote providers via main-process proxy ──
    const fullText = pages.map((p) => `[page ${p.pageIndex + 1}]\n${p.text}`).join('\n\n');
    const messages: ChatMessage[] = buildActionPrompt(action, fullText, userQuestion);
    const requestId = uid('ai');

    let url: string;
    let headers: Record<string, string>;
    let body: string;
    let parser: StreamParser;
    if (settings.provider === 'ollama') {
      const req = buildOllamaRequest({ baseUrl: settings.ollamaUrl, model: settings.ollamaModel }, messages);
      url = req.url;
      headers = { 'Content-Type': 'application/json' };
      body = req.body;
      parser = parseOllamaLine;
    } else {
      if (!settings.openAiBaseUrl || !settings.openAiModel) {
        useAiStore.getState().patchMessage(docKey, assistantId, {
          content: '⚠ Configure the API base URL and model in Settings → AI first.',
          streaming: false
        });
        useAiStore.getState().setBusy(false);
        return;
      }
      const req = buildOpenAiRequest(
        { baseUrl: settings.openAiBaseUrl, apiKey: settings.openAiApiKey, model: settings.openAiModel },
        messages
      );
      url = req.url;
      headers = req.headers;
      body = req.body;
      parser = parseOpenAiSseLine;
    }

    pendingStreams.set(requestId, {
      docKey,
      messageId: assistantId,
      parser,
      buffer: '',
      full: '',
      action,
      prompt: labels[action]
    });
    try {
      await ipc.ai.request({ requestId, url, method: 'POST', headers, body, stream: true });
    } catch (e) {
      pendingStreams.delete(requestId);
      useAiStore.getState().patchMessage(docKey, assistantId, {
        content: `⚠ ${(e as Error).message}`,
        streaming: false
      });
      useAiStore.getState().setBusy(false);
    }
  }
};
