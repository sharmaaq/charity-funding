// A scripted stand-in for the AI, with the same shape as runAI. Used by every automated test and by `AI_FAKE=1` in local
// development (never honoured on Cloud Run). It makes no network call. All names, funders and links are invented.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export const FAKE_DISCOVERY = {
  items: [
    {
      name: 'Reaching Communities England', funder: 'The National Lottery Community Fund', amount: 'From £20,001', timing: 'Open (fake check)',
      summary: 'Updated by the fake run.', fitScore: 71, hardBarrier: false, reason: 'Fake: community support fits.', barriers: ['Needs a qualifying project'],
      guidanceUrl: 'https://www.tnlcommunityfund.org.uk/funding/funding-programmes/reaching-communities-england',
      sources: [{ label: 'Fake source page', url: 'https://example.org/fake-source' }],
    },
    {
      name: 'Example Neighbourhood Fund', funder: 'Example Community Trust', amount: 'Up to £25,000', timing: 'Open until 30 June 2027', opensOn: '2026-10-01', closesOn: '2027-06-30',
      summary: 'A fictional fund for neighbourhood projects.', fitScore: 84, hardBarrier: false, reason: 'Fake: strong fit for the brief.', barriers: [],
      guidanceUrl: 'https://example.org/neighbourhood-fund', sources: [{ label: 'Fund page', url: 'https://example.org/neighbourhood-fund' }, { label: 'Guidance PDF', url: 'https://example.org/neighbourhood-fund/guidance' }],
    },
    {
      name: 'Example Capital Grant', funder: 'Example Property Trust', amount: 'Up to £250,000', timing: 'Rolling',
      summary: 'A fictional capital fund.', fitScore: 30, hardBarrier: true, reason: 'Fake: needs a larger charity.', barriers: ['Minimum income of £5m'],
      guidanceUrl: 'https://example.org/capital-grant', sources: [{ label: 'Fund page', url: 'https://example.org/capital-grant' }],
    },
    { name: 'Insecure link grant', funder: 'Example Trust', amount: 'x', timing: 'x', summary: 's', fitScore: 90, hardBarrier: false, reason: 'r', barriers: [], guidanceUrl: 'http://example.org/insecure', sources: [] },
  ],
  notes: 'Fake run: no real source was checked.',
};

// options: { delayMs, discovery (replace the scripted discovery answer), fail (a message: every call errors), onCall (spy) }
export function createFakeRunner(options = {}) {
  const delayMs = options.delayMs ?? 30;
  const calls = [];
  async function runAI(choice, opts) {
    calls.push({ choice, task: opts.task, prompt: opts.prompt, system: opts.system, history: opts.history, web: opts.web });
    if (options.onCall) options.onCall(calls[calls.length - 1]);
    const emit = opts.onEvent || (() => {});
    emit({ type: 'status', text: `${choice.label || choice.model} is working (fake)` });
    await sleep(delayMs);
    if (options.fail) return { text: '', isError: true, error: options.fail, provider: choice.provider, model: choice.model, searches: [], sources: [] };
    if (opts.task === 'discover') {
      emit({ type: 'tool', name: 'Google Search', detail: 'fake grants for charities' });
      await sleep(delayMs);
      emit({ type: 'tool', name: 'Google Search', detail: 'fake neighbourhood funding' });
      emit({ type: 'source', url: 'https://example.org/fake-source', title: 'Fake source' });
      const structured = options.discovery || FAKE_DISCOVERY;
      return { text: JSON.stringify(structured), structured, searches: ['fake grants for charities', 'fake neighbourhood funding'], sources: [{ url: 'https://example.org/fake-source', title: 'Fake source' }], provider: choice.provider, model: choice.model };
    }
    const FAKE_ASSESSMENT = '## Verdict\n**Apply with changes**, fit score 72/100.\n\n## What the funder wants\n- Fake: community projects\n- Fake: a clear budget\n\n## Eligibility check\n1. Fake rule one: met.\n2. Fake rule two: *missing* the accounts.\n\nSource: [Fake page](https://example.org/fake-source)';
    const reply = typeof options.reply === 'function' ? options.reply(opts)
      : opts.task === 'assess' ? FAKE_ASSESSMENT
        : `Fake answer to: ${String(opts.prompt).slice(-60)} (history ${(opts.history || []).length})`;
    for (const part of reply.match(/.{1,40}/gs) || []) { emit({ type: 'text', text: part }); await sleep(Math.min(delayMs, 10)); }
    return { text: reply, searches: [], sources: [], provider: choice.provider, model: choice.model };
  }
  runAI.calls = calls;
  return runAI;
}
