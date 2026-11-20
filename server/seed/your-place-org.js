// Synthetic demonstration content. Everything here is fictional: the funders, amounts, dates and file
// contents are invented for this demo, and no number below is a real registration or filing number.

import { SYNTHETIC_LABEL } from '../../public/js/org/seed.js';

export { SYNTHETIC_LABEL };

export const SEED_PROFILE = Object.freeze({
  overview: 'Your Place is a demo charity. In this demonstration it provides safe accommodation, advice and practical support to help people who have experienced homelessness in London move into stable homes and rebuild their lives. This is illustrative demo text.',
  beneficiaries: 'People experiencing or at risk of homelessness',
  geography: 'London',
  activities: 'Supported housing, advice and tenancy support, practical help',
  charityNumber: '',
  companyNumber: '',
  website: '',
});

const header = (kind) => `${SYNTHETIC_LABEL}\n${kind}\n\n`;

export const SEED_BIDS = Object.freeze([
  {
    title: 'A fresh start: tenancy support',
    funder: 'Bridgeway Foundation',
    programme: 'Housing and independence round',
    submissionDate: '2026-02-10',
    decisionDate: '2026-04-02',
    outcome: 'successful',
    requestedAmount: 60000,
    awardedAmount: 50000,
    summary: 'Two years of tenancy sustainment support for people moving from supported accommodation into their first independent home, including a named support worker and a move-in budget.',
    feedback: 'The panel valued the clear referral route and the focus on keeping tenancies going. The award was reduced to fit the available fund.',
    notes: 'The budget narrative and the named support worker were the strongest parts. Keep the referral route diagram.',
    files: [
      {
        role: 'bid-document',
        title: 'Submitted application',
        filename: 'bridgeway-tenancy-support-bid-example.txt',
        text: header('Example bid document: A fresh start, tenancy support') + 'Request: GBP 60,000 over two years.\n\nNeed: people leaving supported accommodation often lose their first tenancy within a year without continuing help.\n\nPlan: one named support worker, monthly tenancy visits, a small move-in budget and a peer group.\n\nOutcome we expect: more people still in their homes twelve months after moving in.\n',
      },
    ],
  },
  {
    title: 'Skills for independent living',
    funder: 'Oakfield Giving Fund',
    programme: '',
    submissionDate: '2026-06-18',
    decisionDate: '2026-09-04',
    outcome: 'unsuccessful',
    requestedAmount: 32000,
    awardedAmount: null,
    summary: 'A programme of practical workshops and one-to-one coaching on budgeting, cooking and managing a tenancy for people preparing to move on from hostel accommodation.',
    feedback: 'The proposal showed a strong understanding of local need. We would have liked clearer evidence of sustained outcomes and a more detailed delivery budget.',
    notes: 'Include six- and twelve-month tenancy outcomes next time. Separate workshop costs from one-to-one support in the budget.',
    files: [
      {
        role: 'bid-document',
        title: 'Submitted application',
        filename: 'oakfield-skills-bid-example.txt',
        text: header('Example bid document: Skills for independent living') + 'Request: GBP 32,000 over eighteen months.\n\nNeed: people preparing to move on often lack the day-to-day skills that keep a tenancy going.\n\nPlan: weekly workshops, one-to-one coaching and a short follow-up call after move-in.\n\nOutcome we expect: people feel ready to manage money, food and a home.\n',
      },
      {
        role: 'feedback',
        title: 'Decision and feedback',
        filename: 'oakfield-feedback-example.txt',
        text: header('Example funder feedback') + 'Thank you for your application. The trustees did not award a grant this time.\n\nStrengths: a clear local need and a practical programme.\n\nWeaknesses: limited evidence of sustained outcomes and a delivery budget without enough detail.\n',
      },
    ],
  },
  {
    title: 'Move-on support programme',
    funder: 'Harbour Community Trust',
    programme: 'Autumn 2026 round',
    submissionDate: '2026-10-22',
    decisionDate: null,
    outcome: 'awaiting',
    requestedAmount: 45000,
    awardedAmount: null,
    summary: 'Support for people moving on from emergency accommodation into settled housing, combining advice, a small furnishing fund and follow-up visits.',
    feedback: '',
    notes: '',
    files: [
      {
        role: 'bid-document',
        title: 'Submitted application',
        filename: 'harbour-move-on-bid-example.txt',
        text: header('Example bid document: Move-on support programme') + 'Request: GBP 45,000 over one year.\n\nNeed: moving on from emergency accommodation is a high-risk moment for people who have been homeless.\n\nPlan: housing advice, a furnishing fund and visits at one, three and six months.\n\nDecision expected: early 2027.\n',
      },
    ],
  },
]);

export const SEED_DOCUMENTS = Object.freeze([
  {
    category: 'charity-commission',
    title: 'Charity Commission annual return, 2025/26 (example)',
    filename: 'charity-commission-example.txt',
    period: 'Year ended 31 March 2026',
    description: 'Illustrative example of an annual return submission summary.',
    tags: ['charity commission', 'annual return'],
    text: header('Example Charity Commission submission summary') + 'Charity number: not recorded in this demo.\nReporting period: year ended 31 March 2026.\nSummary: income, expenditure and trustees would be listed here.\n',
  },
  {
    category: 'companies-house',
    title: 'Annual accounts, 2025/26 (example)',
    filename: 'accounts-example.txt',
    period: 'Year ended 31 March 2026',
    description: 'Illustrative example of annual accounts. The demo assessment snapshot elsewhere in this app uses a reported income of about 7.1 million pounds; that is not verified accounts.',
    tags: ['accounts', 'annual', 'finance'],
    text: header('Example annual accounts') + 'Company number: not recorded in this demo.\nPeriod: year ended 31 March 2026.\nThese figures are invented for the demo. A real filing would show income, expenditure, reserves and notes.\n',
  },
  {
    category: 'general',
    title: 'Our services and support (example)',
    filename: 'service-overview.txt',
    period: '',
    description: 'Illustrative overview of services.',
    tags: ['services', 'overview'],
    text: header('Example service overview') + 'We offer safe accommodation, housing advice, tenancy support and practical help.\nPeople reach us through local referrals and walk-in advice sessions.\n',
  },
  {
    category: 'impact',
    title: 'Impact and outcomes (example)',
    filename: 'impact-evidence.txt',
    period: 'Year ended 31 March 2026',
    description: 'Illustrative example of impact evidence.',
    tags: ['impact', 'outcomes'],
    text: header('Example impact evidence') + 'Illustrative outcomes: people supported into settled housing, tenancies sustained at twelve months, and feedback from people we support.\nAll numbers in a real document would come from the charity\'s own records.\n',
  },
]);
