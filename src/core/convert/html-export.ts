/**
 * PDF → HTML: layout-preserving export with absolutely positioned text spans
 * per page (and optional page background images), plus a simpler flowing mode
 * built from reconstructed paragraphs.
 */
import { escapeXml } from '../pdf/utils';
import type { ReconstructedPage } from './text-extract';

export interface HtmlExportOptions {
  mode: 'layout' | 'flow';
  title?: string;
  /** Optional data-URI page backgrounds keyed by pageIndex (layout mode). */
  pageBackgrounds?: Map<number, string>;
}

export function buildHtml(pages: ReconstructedPage[], options: HtmlExportOptions): string {
  const title = escapeXml(options.title ?? 'Exported document');
  const body = options.mode === 'layout' ? layoutBody(pages, options) : flowBody(pages);
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="generator" content="Vikings Master PDF">
<title>${title}</title>
<style>
  body { margin: 0; background: #525659; font-family: Helvetica, Arial, sans-serif; }
  .vk-page { position: relative; margin: 24px auto; background: #fff;
             box-shadow: 0 2px 12px rgba(0,0,0,.35); overflow: hidden; }
  .vk-page > span { position: absolute; white-space: pre; transform-origin: 0 100%; line-height: 1; }
  .vk-flow { max-width: 760px; margin: 0 auto; padding: 48px 32px; background: #fff; }
  .vk-flow h2 { margin: 1.2em 0 .4em; }
  .vk-flow p { line-height: 1.55; margin: .55em 0; }
  .vk-pagebreak { border: none; border-top: 1px dashed #bbb; margin: 2em 0; }
</style>
</head>
<body>
${body}
</body>
</html>`;
}

function layoutBody(pages: ReconstructedPage[], options: HtmlExportOptions): string {
  return pages
    .map((page) => {
      const bg = options.pageBackgrounds?.get(page.pageIndex);
      const bgStyle = bg ? `background-image:url('${bg}');background-size:100% 100%;` : '';
      const spans = page.lines
        .flatMap((line) => line.items)
        .map((item) => {
          const top = page.height - item.y - item.height;
          return `<span style="left:${round(item.x)}px;top:${round(top)}px;font-size:${round(
            item.height || 10
          )}px">${escapeXml(item.str)}</span>`;
        })
        .join('\n');
      return `<div class="vk-page" style="width:${round(page.width)}px;height:${round(
        page.height
      )}px;${bgStyle}">\n${spans}\n</div>`;
    })
    .join('\n');
}

function flowBody(pages: ReconstructedPage[]): string {
  const parts: string[] = ['<div class="vk-flow">'];
  pages.forEach((page, i) => {
    if (i > 0) parts.push('<hr class="vk-pagebreak">');
    for (const para of page.paragraphs) {
      if (para.isHeading) parts.push(`<h2>${escapeXml(para.text)}</h2>`);
      else parts.push(`<p>${escapeXml(para.text)}</p>`);
    }
  });
  parts.push('</div>');
  return parts.join('\n');
}

const round = (n: number): number => Math.round(n * 100) / 100;
