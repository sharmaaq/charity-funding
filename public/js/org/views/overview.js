// Organisation overview and the edit-information form.
import { h, field } from '../dom.js';
import { FIELD_LIMITS } from '../validation.js';
import { OrgError } from '../db.js';
import { ORG_HOME } from '../routes.js';
import { applyErrors, formErrorBanner, guard } from './common.js';

const NOT_RECORDED = 'Not recorded';

function fact(label, value) {
  return h('div', { class: 'fact' }, h('dt', { text: label }), h('dd', { text: value || NOT_RECORDED }));
}

function websiteValue(url) {
  if (!url) return NOT_RECORDED;
  return h('a', { href: url, target: '_blank', rel: 'noopener noreferrer' }, url);
}

// A section element that renders the overview (or its collapsed heading) and swaps in the edit form in place.
export function overviewSection(ctx, profile, { collapsed = false } = {}) {
  const root = h('section', { class: 'overview', 'aria-labelledby': 'overview-heading' });
  let current = profile;

  function showView() {
    root.classList.toggle('collapsed', collapsed);
    if (collapsed) {
      root.replaceChildren(
        h('h2', { id: 'overview-heading', text: 'About YOR Plc' }),
        h('a', { class: 'link-btn', href: ORG_HOME, text: 'Show the full overview' }));
      return;
    }
    const editBtn = guard(ctx, h('button', { type: 'button', class: 'btn', id: 'edit-profile', text: 'Edit organisation information', onclick: showForm }));
    root.replaceChildren(
      h('div', { class: 'overview-main' },
        h('h2', { id: 'overview-heading', text: 'About YOR Plc' }),
        h('p', { class: 'overview-text', 'data-testid': 'overview-text', text: current.overview }),
        h('dl', { class: 'facts' },
          fact('Who we support', current.beneficiaries),
          fact('Where we work', current.geography),
          fact('What we do', current.activities),
          fact('Charity number', current.charityNumber),
          fact('Company number', current.companyNumber),
          h('div', { class: 'fact' }, h('dt', { text: 'Website' }), h('dd', null, websiteValue(current.website))))),
      editBtn);
  }

  function showForm() {
    const fields = [
      field({ name: 'overview', label: 'What the charity does', kind: 'textarea', value: current.overview, required: true, maxlength: FIELD_LIMITS.overview, rows: 5, full: true, hint: `Up to ${FIELD_LIMITS.overview.toLocaleString('en-GB')} characters.` }),
      field({ name: 'beneficiaries', label: 'Who we support', value: current.beneficiaries, maxlength: FIELD_LIMITS.profileOther }),
      field({ name: 'geography', label: 'Where we work', value: current.geography, maxlength: FIELD_LIMITS.profileOther }),
      field({ name: 'activities', label: 'Main activities', value: current.activities, maxlength: FIELD_LIMITS.profileOther, full: true }),
      field({ name: 'charityNumber', label: 'Charity number', value: current.charityNumber, maxlength: FIELD_LIMITS.identifier, hint: 'Optional. Kept exactly as typed, including leading zeros.' }),
      field({ name: 'companyNumber', label: 'Company number', value: current.companyNumber, maxlength: FIELD_LIMITS.identifier, hint: 'Optional. Kept exactly as typed, including leading zeros.' }),
      field({ name: 'website', label: 'Website', value: current.website, inputmode: 'url', maxlength: FIELD_LIMITS.website, full: true, hint: 'Optional. A full address starting with http:// or https://.' }),
    ];
    const banner = formErrorBanner();
    const save = h('button', { type: 'submit', class: 'btn primary', text: 'Save information' });
    const cancel = h('button', { type: 'button', class: 'btn', text: 'Cancel' });
    const form = h('form', { class: 'org-form', novalidate: true, 'aria-labelledby': 'edit-heading' },
      h('h2', { id: 'edit-heading', tabindex: '-1', text: 'Edit organisation information' }),
      h('p', { class: 'field-hint', text: 'The organisation name stays YOR Plc.' }),
      banner.el,
      h('div', { class: 'form-grid' }, fields.map((f) => f.el)),
      h('div', { class: 'actions-row' }, save, cancel));
    let saving = false;
    form.addEventListener('input', () => ctx.setDirty(true));
    form.addEventListener('change', () => ctx.setDirty(true));

    const close = () => {
      ctx.setDirty(false);
      showView();
      const btn = root.querySelector('#edit-profile');
      if (btn) btn.focus();
    };
    cancel.addEventListener('click', async () => {
      if (ctx.isDirty() && !(await ctx.confirmDiscard(cancel))) return;
      close();
    });
    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      if (saving) return;
      banner.show('');
      saving = true;
      save.disabled = true;
      save.textContent = 'Saving...';
      try {
        const raw = Object.fromEntries(fields.map((f) => [f.name, f.control.value]));
        current = await ctx.repo.updateProfile(raw);
        ctx.setDirty(false);
        ctx.announce('Organisation information saved.');
        showView();
        root.querySelector('#edit-profile').focus();
        return;
      } catch (e) {
        const err = e instanceof OrgError ? e : new OrgError('unknown');
        if (err.code === 'invalid') {
          const first = applyErrors(fields, err.errors);
          banner.show('Some details need correcting. Nothing has been saved.');
          if (first) first.focus();
        } else {
          banner.show(`${err.message} Your changes are still in the form.`);
        }
      }
      saving = false;
      save.disabled = false;
      save.textContent = 'Save information';
    });
    root.classList.remove('collapsed');
    root.replaceChildren(form);
    fields[0].control.focus();
  }

  showView();
  return root;
}
