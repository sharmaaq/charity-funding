// Tracking: the demo receipts recorded for this charity, grouped by application, with each attempt's history.
// Demo records only. Nothing here is an award, a decision or an "awaiting decision" status, and no grant record or
// past bid is created or changed.
import { h, formatDateTime, formatBytes, downloadBlob } from '../org/dom.js';
import { mapError } from '../org/db.js';
import { reconcileStale, receiptDocument, subscribe } from './submission-client.js';
import { appHash, reviewHash } from './routes.js';

export const TRACKING_NOTICE = 'Demo records only. Each receipt comes from the controlled test portal run by this demo; nothing was sent to Garfield Weston, and no funding decision exists.';
const STATE_LABEL = {
  demo_completed: 'Demo completed',
  failed: 'Failed',
  cancelled: 'Stopped before submitting',
  interrupted_unknown: 'Not confirmed (outcome unknown)',
  running: 'In progress',
};

// services: () => Promise<{ apps, problem }>. getGrant(id) -> fixture. Returns an element that fills itself.
export function buildTracking({ services, getGrant }) {
  const root = h('section', { class: 'tracking', 'data-testid': 'tracking' });
  const shortHash = (s) => `${s.slice(0, 12)}…${s.slice(-6)}`;

  async function load() {
    root.replaceChildren(h('p', { class: 'placeholder-notice', 'data-testid': 'tracking-notice', text: TRACKING_NOTICE }), h('p', { class: 'loading', role: 'status', text: 'Loading demo receipts…' }));
    let svc;
    try {
      svc = await services();
      if (svc.problem) throw svc.problem;
      await reconcileStale(svc.apps);
      const [receipts, attempts, apps] = await Promise.all([svc.apps.listReceipts(), svc.apps.listAttempts(), svc.apps.list()]);
      paint(receipts, attempts, apps);
    } catch (e) {
      root.replaceChildren(h('p', { class: 'placeholder-notice', 'data-testid': 'tracking-notice', text: TRACKING_NOTICE }),
        h('p', { class: 'form-error', role: 'alert', text: `Demo receipts could not be read: ${mapError(e).message}` }));
    }
  }

  function paint(receipts, attempts, apps) {
    const parts = [h('p', { class: 'placeholder-notice', 'data-testid': 'tracking-notice', text: TRACKING_NOTICE })];
    const withHistory = apps.filter((a) => attempts.some((t) => t.applicationId === a.id));
    if (!withHistory.length) {
      parts.push(h('div', { class: 'empty', 'data-testid': 'tracking-empty' },
        h('p', null, h('strong', null, 'No demo submissions yet.')),
        h('p', null, 'Run the submission demo from the review of the ', h('a', { href: appHash('G-001') }, 'G-001 application'), '. Funding outcomes are not tracked in this demo.')));
    }
    for (const app of withHistory) {
      const grant = getGrant(app.grantId);
      const mine = receipts.filter((r) => r.applicationId === app.id);
      const tries = attempts.filter((t) => t.applicationId === app.id);
      parts.push(h('article', { class: 'track-app', 'data-testid': 'track-app', 'data-grant': app.grantId },
        h('h2', { text: grant ? `${grant.funder}: ${grant.name}` : app.grantId }),
        h('p', { class: 'sub' }, h('span', { class: 'badge demo-badge', text: 'Demo' }), ' ', h('a', { href: reviewHash(app.grantId), text: 'Open the application review' })),
        mine.length ? h('ul', { class: 'receipt-list' }, mine.map((r) => receiptCard(r, grant))) : h('p', { 'data-testid': 'no-receipt', text: 'No demo receipt for this application yet.' }),
        h('h3', { text: 'Attempt history' }),
        h('ol', { class: 'attempt-list', 'data-testid': 'attempt-list' }, tries.map((t) => h('li', { 'data-state': t.state, 'data-testid': 'attempt' },
          h('strong', { text: STATE_LABEL[t.state] || t.state }),
          h('span', { text: ` · started ${formatDateTime(t.startedAt)}${t.endedAt ? ` · ended ${formatDateTime(t.endedAt)}` : ''}${t.tries > 1 ? ` · ${t.tries} tries with the same attempt` : ''}` }),
          t.error && t.error.message ? h('p', { class: 'sub', text: t.error.message }) : null)))));
    }
    root.replaceChildren(...parts);
  }

  function receiptCard(r, grant) {
    const ev = r.evidenceSummary || {};
    return h('li', { class: 'receipt-card', 'data-testid': 'receipt-card' },
      h('p', null, h('span', { class: 'badge demo-badge', text: 'DEMO receipt' }), ' ', h('code', { 'data-testid': 'tracking-reference', text: r.reference })),
      h('p', { text: `Received by the controlled test portal ${formatDateTime(r.confirmedAt)} · snapshot revision ${ev.snapshotRevision ?? ''} · package ${shortHash(r.payloadHash)}` }),
      h('ul', { class: 'issue-list' }, (ev.files || []).map((f) => h('li', { text: `${f.filename} · ${formatBytes(f.sizeBytes)}` }))),
      h('p', { class: 'sub', text: 'Not sent to Garfield Weston. Not an award, a decision or an application awaiting decision.' }),
      h('button', { type: 'button', class: 'btn', 'data-testid': 'tracking-download', text: 'Download receipt', onclick: () => downloadBlob(new Blob([receiptDocument(r, grant && grant.name)], { type: 'application/json' }), `${r.reference}.json`) }));
  }

  const unsubscribe = subscribe((run) => { if (!root.isConnected) { unsubscribe(); return; } if (run.phase !== 'running') load(); });
  load();
  return root;
}
