// Local discovery simulation. It makes no network request and does not interpret the brief.

export const DEFAULT_BRIEF =
  'Find grants for YOR Plc, a London-based charity providing housing and support for people experiencing homelessness, with annual income of approximately GBP 7.1 million. ' +
  'Look for funding for homelessness prevention, accommodation, support services and projects that help people move towards independent living. ' +
  'Include core and running costs, project funding and capital improvements where the fund permits them. ' +
  'Focus on programmes that support work in London or across England and accept charities of our size. ' +
  'Flag funds whose income limits or project-location requirements make us unsuitable, and explain why. ' +
  'Include rolling programmes and opportunities that are open or opening soon. ' +
  'For each opportunity, show the funder, available amount, opening and closing dates where known, a source link and a short explanation of fit; distinguish confirmed eligibility conditions from points that need checking.';

export const DEMO_DELAY_MS = 1000;

export function runMockDiscovery({ brief, delayMs = DEMO_DELAY_MS }) {
  return new Promise((resolve) => {
    setTimeout(() => resolve({ briefUsed: brief }), delayMs);
  });
}
