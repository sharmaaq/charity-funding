// Local discovery simulation. It makes no network request and does not interpret the brief.

export const DEMO_DELAY_MS = 1000;

export function runMockDiscovery({ brief, delayMs = DEMO_DELAY_MS }) {
  return new Promise((resolve) => {
    setTimeout(() => resolve({ briefUsed: brief }), delayMs);
  });
}
