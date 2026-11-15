// The only place grant data lives. Demo data, fixed snapshot of 15 November 2026.

export const PROFILE = {
  name: 'YOR Plc',
  description:
    'Demo charity: a London homelessness housing and support charity with reported annual income of about £7.1m.',
};

export const SNAPSHOT_LABEL = 'Demo discovery - 15 November 2026 snapshot';

export const FIXTURES = [
  {
    id: 'G-001',
    name: 'Regular Grants',
    funder: 'Garfield Weston Foundation',
    amount: 'Under £100,000',
    timing: 'Rolling (original snapshot)',
    summary: "Core, project or capital support for charities through the foundation's Regular Grants route.",
    guidanceUrl: 'https://garfieldweston.org/for-grant-applicants/how-to-apply/',
    guidanceLabel: 'How to apply',
    assessment: 'suitable',
    reason:
      "Suitable candidate: core, project or capital support can fit the charity's work; application and project eligibility still requires review.",
    sources: [{ label: 'How to apply', url: 'https://garfieldweston.org/for-grant-applicants/how-to-apply/' }],
  },
  {
    id: 'G-002',
    name: 'Reaching Communities England',
    funder: 'The National Lottery Community Fund',
    amount: 'From £20,001',
    timing: 'Open at snapshot',
    summary: 'Funding for community projects in England that tackle disadvantage.',
    guidanceUrl: 'https://www.tnlcommunityfund.org.uk/funding/funding-programmes/reaching-communities-england',
    guidanceLabel: 'Programme page',
    assessment: 'suitable',
    reason:
      'Suitable candidate: community support in England and tackling disadvantage align with the demo profile; a qualifying project must be developed.',
    sources: [
      {
        label: 'Programme page',
        url: 'https://www.tnlcommunityfund.org.uk/funding/funding-programmes/reaching-communities-england',
      },
    ],
  },
  {
    id: 'G-003',
    name: 'DPS Social Commitment Programme - Scale',
    funder: 'School for Social Entrepreneurs',
    amount: 'Up to £10,000 plus learning',
    timing: 'Original snapshot extension to noon UK time, 17 November 2026',
    summary:
      'A funded learning programme for organisations growing their social impact, with a housing insecurity and homelessness theme.',
    guidanceUrl: 'https://www.the-sse.org/programme/the-dps-social-commitment-programme-scale/',
    guidanceLabel: 'Programme page',
    assessment: 'suitable',
    reason:
      'Suitable candidate: the housing insecurity and homelessness theme aligns; growth, trading and participant requirements need checking.',
    sources: [
      {
        label: 'Programme page',
        url: 'https://www.the-sse.org/programme/the-dps-social-commitment-programme-scale/',
      },
    ],
  },
  {
    id: 'G-004',
    name: 'Capital grants',
    funder: 'Help the Homeless',
    amount: 'Up to £5,000',
    timing: 'Next quarterly deadline 20 December 2026, 17:00',
    summary: 'Small capital grants for homelessness charities. No core costs or salaries.',
    guidanceUrl: 'https://www.help-the-homeless.org.uk/applying-for-funding',
    guidanceLabel: 'Criteria',
    assessment: 'unsuitable',
    reason:
      "Unsuitable: restricted to charities with turnover below £500,000; YOR Plc's reported £7.1m income exceeds this size limit. Capital-only; no core costs or salaries.",
    sources: [{ label: 'Criteria', url: 'https://www.help-the-homeless.org.uk/applying-for-funding' }],
  },
  {
    id: 'G-005',
    name: 'Sustaining Accommodation Fund',
    funder: 'St Martin-in-the-Fields Charity',
    amount: 'Up to £5,000 block grant, up to £500 per person',
    timing: 'Published closing date 27 November 2026, 17:00',
    summary: 'Grants to help people keep or move into accommodation.',
    guidanceUrl: 'https://smitfc.org/sustaining-accommodation-fund/',
    guidanceLabel: 'Fund page',
    assessment: 'unsuitable',
    reason:
      'Unsuitable: applicants need annual income below £2m; YOR Plc reported £7.1m. The homelessness theme fits, but organisational size does not.',
    sources: [{ label: 'Fund page', url: 'https://smitfc.org/sustaining-accommodation-fund/' }],
  },
  {
    id: 'G-006',
    name: 'National Lottery Awards for All Scotland',
    funder: 'The National Lottery Community Fund',
    amount: '£300 - £20,000',
    timing: 'Open at snapshot',
    summary: 'Funding for community-led projects in Scotland.',
    guidanceUrl:
      'https://www.tnlcommunityfund.org.uk/funding/funding-programmes/national-lottery-awards-for-all-scotland',
    guidanceLabel: 'Programme page',
    assessment: 'unsuitable',
    reason:
      'Unsuitable for this London service scenario: funds projects in Scotland. This is a project-location mismatch, not a claim that a London-registered charity could never run a Scottish project.',
    sources: [
      {
        label: 'Programme page',
        url: 'https://www.tnlcommunityfund.org.uk/funding/funding-programmes/national-lottery-awards-for-all-scotland',
      },
    ],
  },
];
