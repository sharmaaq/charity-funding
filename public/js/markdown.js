// A small, safe markdown renderer for AI answers (REQ-041, REQ-042). It builds DOM nodes with textContent only, never
// innerHTML, so nothing the model (or a web page it read) writes can inject markup or script. Links must be https.
// Supported: headings (#..####), paragraphs, bullet and numbered lists, **bold**, *italic*, `code`, [text](https://...)
// and bare https links. Anything else is shown as plain text.

const LINK = /\[([^\]\n]{1,200})\]\((https:\/\/[^\s)]{1,500})\)/;
const BARE = /https:\/\/[^\s<>()]{1,500}[^\s<>().,;:!?'"]/;

export function parseInline(text) {
  const out = [];
  let rest = String(text);
  const push = (n) => out.push(n);
  while (rest.length) {
    const cands = [];
    const m = (re, kind) => { const x = re.exec(rest); if (x) cands.push({ kind, x }); };
    m(/`([^`\n]+)`/, 'code');
    m(/\*\*([^*\n]+)\*\*/, 'strong');
    m(/(?<![*\w])\*([^*\n]+)\*(?![*\w])/, 'em');
    m(LINK, 'link');
    m(BARE, 'bare');
    if (!cands.length) { push({ t: 'text', v: rest }); break; }
    cands.sort((a, b) => a.x.index - b.x.index);
    const { kind, x } = cands[0];
    if (x.index > 0) push({ t: 'text', v: rest.slice(0, x.index) });
    if (kind === 'code') push({ t: 'code', v: x[1] });
    else if (kind === 'strong') push({ t: 'strong', c: parseInline(x[1]) });
    else if (kind === 'em') push({ t: 'em', c: parseInline(x[1]) });
    else if (kind === 'link') push({ t: 'link', href: x[2], c: [{ t: 'text', v: x[1] }] });
    else push({ t: 'link', href: x[0], c: [{ t: 'text', v: x[0] }] });
    rest = rest.slice(x.index + x[0].length);
  }
  return out;
}

export function parseMarkdown(text) {
  const blocks = [];
  let para = [];
  let list = null;
  const flushPara = () => { if (para.length) { blocks.push({ t: 'p', c: parseInline(para.join(' ')) }); para = []; } };
  const flushList = () => { if (list) { blocks.push(list); list = null; } };
  for (const raw of String(text).replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.trimEnd();
    const h = /^(#{1,4})\s+(.+)$/.exec(line);
    const ul = /^\s*[-*+]\s+(.+)$/.exec(line);
    const ol = /^\s*\d{1,3}[.)]\s+(.+)$/.exec(line);
    if (!line.trim()) { flushPara(); flushList(); continue; }
    if (h) { flushPara(); flushList(); blocks.push({ t: 'h', level: Math.min(h[1].length + 1, 5), c: parseInline(h[2]) }); continue; }
    if (ul || ol) {
      flushPara();
      const kind = ul ? 'ul' : 'ol';
      if (!list || list.t !== kind) { flushList(); list = { t: kind, items: [] }; }
      list.items.push(parseInline((ul || ol)[1]));
      continue;
    }
    flushList();
    para.push(line.trim());
  }
  flushPara();
  flushList();
  return blocks;
}

function inlineNodes(doc, nodes) {
  return nodes.map((n) => {
    if (n.t === 'text') return doc.createTextNode(n.v);
    if (n.t === 'code') { const e = doc.createElement('code'); e.textContent = n.v; return e; }
    if (n.t === 'link') {
      const a = doc.createElement('a');
      a.setAttribute('href', n.href);
      a.setAttribute('target', '_blank');
      a.setAttribute('rel', 'noopener noreferrer');
      a.append(...inlineNodes(doc, n.c));
      return a;
    }
    const e = doc.createElement(n.t === 'strong' ? 'strong' : 'em');
    e.append(...inlineNodes(doc, n.c));
    return e;
  });
}

// Returns a DocumentFragment-like list of elements for the text. doc: a Document (the browser's by default).
export function renderMarkdown(text, doc = document) {
  const frag = doc.createDocumentFragment();
  for (const b of parseMarkdown(text)) {
    if (b.t === 'h') { const e = doc.createElement(`h${b.level}`); e.append(...inlineNodes(doc, b.c)); frag.append(e); }
    else if (b.t === 'p') { const e = doc.createElement('p'); e.append(...inlineNodes(doc, b.c)); frag.append(e); }
    else {
      const e = doc.createElement(b.t);
      for (const item of b.items) { const li = doc.createElement('li'); li.append(...inlineNodes(doc, item)); e.append(li); }
      frag.append(e);
    }
  }
  return frag;
}
