// The worked synthetic example (spec section 5). Everything here is fictional. In particular there is NO registration
// number, no real address, no real person and no real partner organisation. Values are exactly those in the spec.
//
// The accounts document is not in VALUES: it is a stored file, so buildExampleAnswers only selects it when the caller
// passes the stored synthetic accounts document (see accounts-example.js). Without one the accounts selection stays
// unanswered, rather than pointing at something that does not exist.

export const EXAMPLE_LABEL = 'Synthetic demo example — not a real application or financial filing';
export const EXAMPLE_ID = 'worked-demo-example';
export const EXAMPLE_VERSION = '2026-11-15';

const GBP = (pounds) => pounds * 100;

const VALUES = {
  'org.name': 'Your Place',
  'org.type': 'synthetic-registered-charity',
  'org.address': 'Demo office, London',
  'org.postcode': 'E16 1AA',
  'org.overview': 'Your Place, in this demonstration, provides accommodation together with practical support for people who have experienced homelessness in London. Staff help residents to settle into a stable home, build everyday tenancy and budgeting skills, and reach the other services they need. All of the facts in this worked example are fictional and are provided only to show how an application is prepared.',
  'org.geography': 'London',
  'contact.firstName': 'Alex',
  'contact.lastName': 'Morgan',
  'contact.role': 'Fundraising Manager',
  'contact.employment': 'staff',
  'contact.email': 'alex.morgan@example.org',
  'contact.phone': '00000000000',
  'compliance.ukTaxResident': 'yes',
  'compliance.safeguarding': 'yes',
  'compliance.demographics': 'Not collected in example. No demographic percentages are claimed in this synthetic demonstration.',
  'request.type': 'core',
  'request.title': 'Housing stability and support — core services',
  'request.amountMode': 'specified',
  'request.amountPence': GBP(50000),
  'request.start': '2027-06-01',
  'request.end': '2028-05-31',
  'request.people': 250,
  'request.reason': 'This worked example asks for a contribution towards the general running costs of the demonstration housing and support service for twelve months. The shared costs include staffing, accommodation and utilities, and the administration that keeps the service safe and well organised. Core funding allows the service to keep one consistent offer for residents instead of depending on separate project grants. The amount, dates and budget are fictional and exist only to demonstrate the questionnaire.',
  'eligibility.previousApplication': 'no',
  'work.need': 'People who have experienced homelessness often need more than a room. They need a steady place to live, someone to help them understand a tenancy, and support to manage money and appointments. Without that help, a first stable home can be lost quickly. In this fictional example, local demand for supported accommodation is greater than the number of places available, and residents are asked what support would help them most. No statistics are claimed here.',
  'work.activities': 'The service provides supported accommodation, an individual action plan for each resident, and practical help with tenancy, budgeting and referrals to health, advice and other local services. Each action plan is reviewed with the resident every quarter, and residents are encouraged to say what is working. Staff are available at set times each week and by arrangement, so that support is predictable and accessible. All details are illustrative.',
  'work.beneficiaries': 'The people supported are adults in London who have experienced homelessness or are at risk of losing their home and who need practical support alongside accommodation. In this fictional example, people are referred by local services or come forward directly, and their circumstances differ widely.',
  'work.annualPeople': 250,
  'work.peopleNotes': 'Fictional figures for the demonstration. People are counted once each in the year, and the planned reach for the funded year is set equal to a typical year.',
  'work.outcomes': 'The service will track whether people stay engaged with their support and whether they keep a stable home. Engagement is recorded at each quarterly review of the action plan, and housing stability is recorded when people move on or when a tenancy is reviewed. The example does not claim any success rates. Resident feedback is gathered regularly and used to adjust how the service works.',
  'work.inclusion': 'Appointments are offered at different times and in different places so that people with caring, health or work commitments can attend. Information is given in plain language and in other formats on request. Residents are asked for feedback at least once a quarter, and the team reviews it together to change how the service works.',
  'work.partnerships': 'Residents are referred to and from local health, advice and housing services through generic referral relationships. No named partner organisations are used in this fictional example.',
  'work.leadership': 'A fictional management team with experience of housing and support services leads the work, supported by a governing board that meets regularly and reviews finances and safeguarding. These roles and this experience are illustrative and do not describe real people.',
  'finance.reportingEnd': '2026-03-31',
  'finance.historicalIncomePence': GBP(7000000),
  'finance.incomeRows': [
    { label: 'Service contracts', targetPence: GBP(5800000), securedPence: GBP(5650000), note: 'Synthetic example' },
    { label: 'Trusts and foundations', targetPence: GBP(700000), securedPence: GBP(500000), note: 'Synthetic example' },
    { label: 'Donations', targetPence: GBP(300000), securedPence: GBP(200000), note: 'Synthetic example' },
    { label: 'Other earned income', targetPence: GBP(200000), securedPence: GBP(150000), note: 'Synthetic example' },
  ],
  'finance.expenseRows': [
    { label: 'Overall staffing', amountPence: GBP(4200000), note: 'Synthetic example' },
    { label: 'Accommodation and utilities', amountPence: GBP(1800000), note: 'Synthetic example' },
    { label: 'Service delivery', amountPence: GBP(550000), note: 'Synthetic example' },
    { label: 'Administration and governance', amountPence: GBP(250000), note: 'Synthetic example' },
    { label: 'Training and evaluation', amountPence: GBP(100000), note: 'Synthetic example' },
  ],
  'finance.forecastStart': '2027-06-01',
  'finance.forecastEnd': '2028-05-31',
  'finance.fundraising': 'The remaining income needed to close the current gap will be sought from a mixture of trusts and foundations, donations and other earned income. The forecast shows how much of each income line is already secured. No funding is treated as secured unless it appears in the secured column, and the requested grant is not counted as secured income. Progress against the targets is reviewed each quarter.',
  'finance.reserves': 'None to explain. This example does not plan any contribution to reserves.',
  'finance.fallback': 'If less income is raised than planned, the service would protect essential accommodation and safety-critical support first. Other activities would be phased or reduced, and residents who use them would be told in advance and helped to find alternatives.',
  'evidence.accountsPeriod': 'Year ended 31 March 2026 (synthetic example)',
  'evidence.accountsKind': 'synthetic-accounts-example',
};

// These need the manager's explicit demo review: they stand in for facts and declarations, so they stay "Needs review".
const DEMO_REVIEW = new Set(['eligibility.previousApplication', 'compliance.ukTaxResident', 'compliance.safeguarding', 'compliance.demographics']);
const ILLUSTRATIVE = new Set(['org.address', 'org.postcode', 'contact.phone', ...DEMO_REVIEW]);

export const EXAMPLE_VALUES = Object.freeze(VALUES);
export const EXAMPLE_FIELD_IDS = Object.freeze(Object.keys(VALUES));

// Answers for exactly the fields above, every one carrying origin synthetic-demo and a visible synthetic source.
// accountsDoc (optional): the stored synthetic accounts document { id, title, filename, updatedAt }.
export function buildExampleAnswers(nowIso, accountsDoc = null) {
  const out = {};
  for (const [id, value] of Object.entries(VALUES)) {
    const ref = {
      kind: 'synthetic-example',
      recordId: EXAMPLE_ID,
      title: 'Worked demo example',
      updatedAt: EXAMPLE_VERSION,
      synthetic: true,
      excerpt: ILLUSTRATIVE.has(id) ? `Illustrative demo value, not a real fact. ${EXAMPLE_LABEL}` : EXAMPLE_LABEL,
    };
    out[id] = {
      value: JSON.parse(JSON.stringify(value)),
      origin: 'synthetic-demo',
      sourceRefs: [ref],
      confirmedAt: DEMO_REVIEW.has(id) ? null : nowIso,
      editedAt: null,
    };
  }
  if (accountsDoc && accountsDoc.id) {
    out['evidence.accountsId'] = {
      value: accountsDoc.id,
      origin: 'synthetic-demo',
      sourceRefs: [{ kind: 'document', recordId: accountsDoc.id, documentId: accountsDoc.id, title: accountsDoc.title || accountsDoc.filename, updatedAt: accountsDoc.updatedAt || null, reportingPeriod: accountsDoc.period || undefined, synthetic: true, excerpt: EXAMPLE_LABEL }],
      confirmedAt: nowIso,
      editedAt: null,
    };
  }
  return out;
}
