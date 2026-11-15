// Confirmation dialog on the native <dialog> element. Resolves true only when the confirm button is used.
import { h, uid } from '../dom.js';

export function confirmDialog({ title, message, confirmLabel, cancelLabel = 'Cancel', returnFocus }) {
  const trigger = returnFocus || document.activeElement;
  return new Promise((resolve) => {
    const titleId = uid('dlg-title');
    const descId = uid('dlg-desc');
    let result = false;
    const cancel = h('button', { type: 'button', class: 'btn', text: cancelLabel, onclick: () => dlg.close() });
    const ok = h('button', { type: 'button', class: 'btn primary', text: confirmLabel, onclick: () => { result = true; dlg.close(); } });
    const dlg = h('dialog', { class: 'dialog', 'aria-labelledby': titleId, 'aria-describedby': descId },
      h('h2', { id: titleId, text: title }),
      h('p', { id: descId }, message),
      h('div', { class: 'dialog-actions' }, cancel, ok));
    dlg.addEventListener('close', () => {
      dlg.remove();
      const el = typeof trigger === 'function' ? trigger() : trigger;
      if (el && el.isConnected && typeof el.focus === 'function') el.focus();
      resolve(result);
    });
    document.body.append(dlg);
    dlg.showModal();
    cancel.focus(); // the safe choice has focus first
  });
}
