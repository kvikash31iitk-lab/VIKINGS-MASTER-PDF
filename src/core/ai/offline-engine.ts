/**
 * Offline AI engine — deterministic extractive NLP that works with zero
 * network access: frequency-scored summarization, key points, action-item
 * mining, FAQ generation and grounded document Q&A with page citations.
 */

export interface ScoredSentence {
  text: string;
  pageIndex: number;
  score: number;
  position: number;
}

const STOPWORDS = new Set(
  (
    'a,an,the,and,or,but,if,then,else,of,at,by,for,with,about,against,between,into,through,' +
    'during,before,after,above,below,to,from,up,down,in,out,on,off,over,under,again,further,' +
    'is,am,are,was,were,be,been,being,have,has,had,having,do,does,did,doing,will,would,' +
    'shall,should,may,might,must,can,could,not,no,nor,only,own,same,so,than,too,very,just,' +
    'this,that,these,those,it,its,he,she,they,them,his,her,their,we,us,our,you,your,i,me,my,' +
    'as,also,such,per,via,etc,ie,eg'
  ).split(',')
);

export function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?।])\s+(?=[A-Z0-9"'(ऀ-ॿ])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 12 && s.length < 600);
}

function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[a-zऀ-ॿ][a-z0-9ऀ-ॿ'-]{1,}/g) ?? []).filter(
    (w) => !STOPWORDS.has(w)
  );
}

function buildFrequencies(sentences: string[]): Map<string, number> {
  const freq = new Map<string, number>();
  for (const s of sentences) {
    for (const w of tokenize(s)) freq.set(w, (freq.get(w) ?? 0) + 1);
  }
  // Normalize by max frequency.
  const max = Math.max(1, ...freq.values());
  for (const [k, v] of freq) freq.set(k, v / max);
  return freq;
}

export function scoreSentences(pages: Array<{ pageIndex: number; text: string }>): ScoredSentence[] {
  const all: Array<{ text: string; pageIndex: number }> = [];
  for (const page of pages) {
    for (const s of splitSentences(page.text)) all.push({ text: s, pageIndex: page.pageIndex });
  }
  const freq = buildFrequencies(all.map((s) => s.text));
  return all.map((s, i) => {
    const words = tokenize(s.text);
    const base = words.reduce((sum, w) => sum + (freq.get(w) ?? 0), 0) / Math.max(words.length, 1);
    // Slight boost for early sentences and those with numbers/dates (often factual).
    const positionBoost = i < all.length * 0.15 ? 0.08 : 0;
    const numberBoost = /\d/.test(s.text) ? 0.04 : 0;
    return { text: s.text, pageIndex: s.pageIndex, score: base + positionBoost + numberBoost, position: i };
  });
}

export function summarize(pages: Array<{ pageIndex: number; text: string }>, maxSentences = 6): string {
  const scored = scoreSentences(pages);
  if (scored.length === 0) return 'The document contains no extractable text. Run OCR first if this is a scanned document.';
  const top = [...scored]
    .sort((a, b) => b.score - a.score)
    .slice(0, maxSentences)
    .sort((a, b) => a.position - b.position);
  return top.map((s) => s.text).join(' ');
}

export function keyPoints(pages: Array<{ pageIndex: number; text: string }>, maxPoints = 10): string {
  const scored = scoreSentences(pages);
  if (scored.length === 0) return 'No extractable text found.';
  const top = [...scored]
    .sort((a, b) => b.score - a.score)
    .slice(0, maxPoints)
    .sort((a, b) => a.position - b.position);
  return top.map((s) => `• ${condense(s.text)} (p. ${s.pageIndex + 1})`).join('\n');
}

const ACTION_PATTERNS =
  /\b(must|shall|should|required to|need to|needs to|due (?:by|on)|deadline|no later than|responsible for|agrees? to|will (?:provide|deliver|submit|pay|complete)|action item|to-?do|follow[- ]?up)\b/i;

export function actionItems(pages: Array<{ pageIndex: number; text: string }>): string {
  const found: Array<{ text: string; page: number }> = [];
  for (const page of pages) {
    for (const s of splitSentences(page.text)) {
      if (ACTION_PATTERNS.test(s)) found.push({ text: s, page: page.pageIndex + 1 });
      if (found.length >= 20) break;
    }
  }
  if (found.length === 0) return 'No explicit action items, obligations or deadlines were detected.';
  return found.map((f) => `☐ ${condense(f.text)} (p. ${f.page})`).join('\n');
}

export function generateFaq(pages: Array<{ pageIndex: number; text: string }>, maxItems = 8): string {
  const scored = scoreSentences(pages);
  if (scored.length === 0) return 'No extractable text found.';
  const freq = buildFrequencies(scored.map((s) => s.text));
  const topTerms = [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxItems * 2)
    .map(([w]) => w);

  const out: string[] = [];
  const used = new Set<number>();
  for (const term of topTerms) {
    if (out.length >= maxItems * 2) break;
    const best = scored
      .filter((s, i) => !used.has(i) && s.text.toLowerCase().includes(term))
      .sort((a, b) => b.score - a.score)[0];
    if (!best) continue;
    used.add(best.position);
    out.push(`Q: What does the document say about “${term}”?`);
    out.push(`A: ${condense(best.text)} (p. ${best.pageIndex + 1})\n`);
  }
  return out.length > 0 ? out.join('\n') : 'Could not generate FAQs from this document.';
}

export function answerQuestion(pages: Array<{ pageIndex: number; text: string }>, question: string): string {
  const queryTerms = tokenize(question);
  if (queryTerms.length === 0) return 'Please ask a more specific question about the document.';
  const scored = scoreSentences(pages)
    .map((s) => {
      const sentTerms = new Set(tokenize(s.text));
      let overlap = 0;
      for (const t of queryTerms) {
        if (sentTerms.has(t)) overlap++;
        else if ([...sentTerms].some((st) => st.startsWith(t) || t.startsWith(st))) overlap += 0.5;
      }
      return { ...s, score: overlap / queryTerms.length + s.score * 0.15 };
    })
    .filter((s) => s.score > 0.25)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  if (scored.length === 0) {
    return 'The document does not appear to contain information answering that question.';
  }
  return scored
    .sort((a, b) => a.position - b.position)
    .map((s) => `${s.text} (p. ${s.pageIndex + 1})`)
    .join('\n\n');
}

function condense(s: string): string {
  return s.length > 220 ? `${s.slice(0, 217)}…` : s;
}
