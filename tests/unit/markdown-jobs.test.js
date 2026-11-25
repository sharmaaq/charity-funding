import test from 'node:test';
import assert from 'node:assert/strict';
import { parseInline, parseMarkdown, renderMarkdown } from '../../public/js/markdown.js';
import { followJob } from '../../public/js/jobs.js';

test('headings, paragraphs and both kinds of list', () => {
  const b = parseMarkdown('## Verdict\n**Apply**, fit 72/100.\nSecond line.\n\n- one\n- two\n\n1. first\n2) second');
  assert.deepEqual(b.map((x) => x.t), ['h', 'p', 'ul', 'ol']);
  assert.equal(b[0].level, 3);
  assert.deepEqual(b[1].c.map((x) => x.t), ['strong', 'text']);
  assert.equal(b[1].c[1].v, ', fit 72/100. Second line.');
  assert.equal(b[2].items.length, 2);
  assert.equal(b[3].items.length, 2);
});

test('only https links become links; markup and script stay as text', () => {
  const n = parseInline('See [the page](https://example.org/a), https://example.org/b. Not [this](javascript:alert(1)) or <script>alert(1)</script> or [x](http://example.org).');
  const links = n.filter((x) => x.t === 'link');
  assert.deepEqual(links.map((l) => l.href), ['https://example.org/a', 'https://example.org/b']);
  const text = n.filter((x) => x.t === 'text').map((x) => x.v).join('');
  assert.ok(text.includes('<script>alert(1)</script>'));
  assert.ok(text.includes('[this](javascript:alert(1))'));
  assert.ok(!n.some((x) => x.t === 'link' && /^javascript|^http:/.test(x.href)));
});

test('inline code, bold and italic', () => {
  const n = parseInline('a `code` **bold** and *it* x');
  assert.ok(n.some((x) => x.t === 'code' && x.v === 'code'));
  assert.ok(n.some((x) => x.t === 'strong'));
  assert.ok(n.some((x) => x.t === 'em'));
});

// A minimal DOM, enough to check that rendering builds nodes and never parses markup.
function fakeDoc() {
  const mk = (tag) => ({ tag, children: [], attrs: {}, append(...c) { this.children.push(...c); }, setAttribute(k, v) { this.attrs[k] = v; }, set textContent(v) { this.children.push({ text: v }); } });
  return { createElement: mk, createTextNode: (t) => ({ text: t }), createDocumentFragment: () => mk('#frag') };
}
test('rendering uses text nodes only, and links carry rel and target', () => {
  const frag = renderMarkdown('## T\nHello <b>x</b> [ok](https://example.org)', fakeDoc());
  const p = frag.children[1];
  assert.equal(frag.children[0].tag, 'h3');
  assert.equal(p.children[0].text, 'Hello <b>x</b> ');
  assert.equal(p.children[1].tag, 'a');
  assert.equal(p.children[1].attrs.rel, 'noopener noreferrer');
  assert.equal(p.children[1].attrs.target, '_blank');
});

// A scripted EventSource: each connection plays the given messages, then optionally errors.
function scripted(connections) {
  let n = 0;
  return class {
    constructor() {
      const plan = connections[n++];
      queueMicrotask(() => {
        for (const m of plan.messages) this.onmessage({ data: JSON.stringify(m) });
        if (plan.error) this.onerror();
      });
    }
    close() { this.closed = true; }
  };
}
test('followJob delivers events, resolves with the result, and skips replayed events after a reconnect', async () => {
  const seen = [];
  const ES = scripted([
    { messages: [{ type: 'status', text: 'a' }, { type: 'status', text: 'b' }], error: true },
    { messages: [{ type: 'status', text: 'a' }, { type: 'status', text: 'b' }, { type: 'status', text: 'c' }, { type: 'done', result: { ok: 1 } }] },
  ]);
  const result = await followJob('/x', (e) => seen.push(e.text), { EventSourceImpl: ES, retryMs: 1 });
  assert.deepEqual(seen, ['a', 'b', 'c']);
  assert.deepEqual(result, { ok: 1 });
});

test('followJob rejects with the job error, and gives up after repeated failures', async () => {
  await assert.rejects(followJob('/x', () => {}, { EventSourceImpl: scripted([{ messages: [{ type: 'error', error: 'boom' }] }]) }), /boom/);
  const dead = scripted(Array.from({ length: 10 }, () => ({ messages: [], error: true })));
  await assert.rejects(followJob('/x', () => {}, { EventSourceImpl: dead, retryMs: 1, maxRetries: 2 }), /Lost contact/);
});
