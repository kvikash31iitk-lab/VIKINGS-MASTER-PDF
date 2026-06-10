/** AI Assistant panel — quick actions + grounded document chat. */
import { useEffect, useRef, useState } from 'react';
import { useActiveDoc } from '../../../stores/documents-store';
import { useAiStore } from '../../../stores/ui-stores';
import { useSettingsStore } from '../../../stores/settings-store';
import { aiService } from '../../../services/ai-service';
import { Icon } from '../../common/Icon';
import { Button, EmptyState, Select, Spinner } from '../../common/controls';
import { cx, EMPTY } from '../../../utils';

export function AiAssistantPanel() {
  const doc = useActiveDoc();
  const messages = useAiStore((s) => (doc ? s.conversations[doc.id] ?? EMPTY : EMPTY));
  const busy = useAiStore((s) => s.busy);
  const provider = useSettingsStore((s) => s.settings.ai.provider);
  const update = useSettingsStore((s) => s.update);
  const [question, setQuestion] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  if (!doc) return <EmptyState icon="ai" title="No document open" hint="Open a PDF to ask questions about it." />;

  const ask = (): void => {
    const q = question.trim();
    if (!q || busy) return;
    setQuestion('');
    void aiService.runAction(doc.id, 'chat', q);
  };

  const Quick = ({ label, icon, action }: { label: string; icon: string; action: 'summarize' | 'keypoints' | 'actions' | 'faq' }) => (
    <Button variant="secondary" className="h-7 px-2 text-2xs" disabled={busy} onClick={() => void aiService.runAction(doc.id, action)}>
      <Icon name={icon} size={12} /> {label}
    </Button>
  );

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-col gap-2 border-b border-app-border p-2">
        <Select
          value={provider}
          onChange={(v) => void update('ai.provider', v)}
          options={[
            { value: 'offline', label: 'Built-in engine (offline)' },
            { value: 'ollama', label: 'Ollama (local LLM)' },
            { value: 'openai-compatible', label: 'OpenAI-compatible API' }
          ]}
        />
        <div className="flex flex-wrap gap-1">
          <Quick label="Summarize" icon="summarize" action="summarize" />
          <Quick label="Key points" icon="bulb" action="keypoints" />
          <Quick label="Actions" icon="check" action="actions" />
          <Quick label="FAQ" icon="help" action="faq" />
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-2" aria-live="polite">
        {messages.length === 0 ? (
          <EmptyState icon="ai" title="Ask about this document" hint="Answers cite page numbers and stay grounded in the document text." />
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={cx(
                'mb-2 max-w-[94%] whitespace-pre-wrap rounded-lg px-2.5 py-2 text-xs leading-relaxed',
                m.role === 'user'
                  ? 'ml-auto bg-app-accent text-app-accent-text'
                  : 'select-text border border-app-border bg-app-surface-2 text-app-text'
              )}
            >
              {m.content || (m.streaming ? '…' : '')}
              {m.streaming && <Spinner size={11} />}
            </div>
          ))
        )}
      </div>

      <div className="flex gap-1.5 border-t border-app-border p-2">
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && ask()}
          placeholder="Ask about this document…"
          aria-label="Ask the AI assistant"
          className="h-8 flex-1 rounded-md border border-app-border-strong bg-app-surface px-2.5 text-xs outline-none focus:border-app-accent"
        />
        <Button variant="primary" onClick={ask} disabled={busy || !question.trim()} aria-label="Send">
          {busy ? <Spinner size={13} /> : <Icon name="chevron-right" size={14} />}
        </Button>
      </div>
    </div>
  );
}
