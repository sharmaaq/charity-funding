// Versioned field mapping for the controlled test portal, kept apart from the runner code (spec section 9).
// It applies ONLY to this project's own test portal (gwf-demo-v1). It says nothing about the real funder's portal.
//
// Each entry: { key: portal data-field, kind, value(flat answers) -> portal string | boolean | undefined }.
// undefined means "this answer is not in the package": the runner leaves the control untouched.
export const MAP_VERSION = 'gwf-demo-map.v1';
export const PORTAL_VERSION = 'gwf-demo-v1';

const text = (id) => (a) => (a[id] === undefined || a[id] === null ? undefined : String(a[id]));
const pounds = (id) => (a) => (Number.isSafeInteger(a[id]) ? (a[id] / 100).toFixed(2) : undefined); // pence -> "50000.00", no separators
const number = (id) => (a) => (Number.isSafeInteger(a[id]) ? String(a[id]) : undefined);

export const PAGES = Object.freeze([
  { id: 'organisation', next: 'request', fields: [
    { key: 'org.name', kind: 'text', value: text('org.name') },
    { key: 'org.type', kind: 'select', value: text('org.type') },
    { key: 'org.charityNumber', kind: 'text', value: text('org.charityNumber') },
    { key: 'syntheticApplicant', kind: 'checkbox', value: (_a, m) => m.syntheticApplicant === true },
    { key: 'org.address', kind: 'textarea', value: text('org.address') },
    { key: 'org.postcode', kind: 'text', value: text('org.postcode') },
    { key: 'org.website', kind: 'text', value: text('org.website') },
    { key: 'contact.firstName', kind: 'text', value: text('contact.firstName') },
    { key: 'contact.lastName', kind: 'text', value: text('contact.lastName') },
    { key: 'contact.role', kind: 'text', value: text('contact.role') },
    { key: 'contact.employment', kind: 'select', value: text('contact.employment') },
    { key: 'contact.email', kind: 'text', value: text('contact.email') },
    { key: 'contact.phone', kind: 'text', value: text('contact.phone') },
  ] },
  { id: 'request', next: 'compliance', fields: [
    { key: 'request.type', kind: 'select', value: text('request.type') },
    { key: 'request.title', kind: 'text', value: text('request.title') },
    // amountMode never leaves the browser; the presence of an amount says which mode the manager chose.
    { key: 'request.amountMode', kind: 'select', value: (a) => (Number.isSafeInteger(a['request.amountPence']) ? 'specified' : 'discretion') },
    { key: 'request.amountPence', kind: 'text', value: pounds('request.amountPence') },
    { key: 'request.start', kind: 'date', value: text('request.start') },
    { key: 'request.end', kind: 'date', value: text('request.end') },
    { key: 'org.geography', kind: 'textarea', value: text('org.geography') },
    { key: 'work.annualPeople', kind: 'number', value: number('work.annualPeople') },
    { key: 'request.people', kind: 'number', value: number('request.people') },
    { key: 'finance.historicalIncomePence', kind: 'text', value: pounds('finance.historicalIncomePence') },
    { key: 'finance.reportingEnd', kind: 'date', value: text('finance.reportingEnd') },
  ] },
  { id: 'compliance', next: 'documents', fields: [
    { key: 'eligibility.previousApplication', kind: 'select', value: text('eligibility.previousApplication') },
    { key: 'compliance.ukTaxResident', kind: 'select', value: text('compliance.ukTaxResident') },
    { key: 'compliance.safeguarding', kind: 'select', value: text('compliance.safeguarding') },
    { key: 'compliance.safeguardingExplanation', kind: 'textarea', value: text('compliance.safeguardingExplanation') },
    { key: 'compliance.demographics', kind: 'textarea', value: text('compliance.demographics') },
    { key: 'compliance.contactPermission', kind: 'select', value: text('compliance.contactPermission') },
  ] },
]);

export const FILE_ROLES = Object.freeze(['proposal', 'accounts']);

// What the portal's review page is expected to show for one mapped field.
export function reviewText(field, v) {
  if (field.kind === 'checkbox') return v ? 'yes' : 'no';
  return v === undefined ? '' : String(v).replace(/\r\n?/g, '\n');
}
