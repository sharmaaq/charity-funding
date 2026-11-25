// Follows a server job's events (server-sent events). The server replays every event from the start, so a reload or a
// dropped connection is safe: a reconnect skips the events already seen.
// onEvent(e) gets { type: 'status' | 'tool' | 'text' | 'source' | ... }. Resolves with the job's result, rejects with its error.
export function followJob(url, onEvent, { EventSourceImpl = globalThis.EventSource, retryMs = 1500, maxRetries = 5 } = {}) {
  return new Promise((resolve, reject) => {
    let received = 0;
    let retries = 0;
    const open = () => {
      let idx = 0;
      const skipTo = received;
      const es = new EventSourceImpl(url);
      es.onmessage = (m) => {
        idx += 1;
        if (idx <= skipTo) return;
        received = idx;
        retries = 0;
        let e;
        try { e = JSON.parse(m.data); } catch { return; }
        if (e.type === 'done') { es.close(); resolve(e.result); } else if (e.type === 'error') { es.close(); reject(new Error(e.error || 'The run failed.')); } else onEvent(e);
      };
      es.onerror = () => {
        es.close();
        retries += 1;
        if (retries > maxRetries) { reject(new Error('Lost contact with the run. Reload the page to see whether it finished.')); return; }
        setTimeout(open, retryMs);
      };
    };
    open();
  });
}
