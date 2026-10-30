// Small DOM helpers shared by all pages.

export const $ = (id) => document.getElementById(id);

// Shows the <section class="screen"> with this id and hides the others.
export function showScreen(id) {
  document.querySelectorAll('.screen').forEach((s) => { s.hidden = s.id !== id; });
}

// Creates an element with an optional class and text. Text is never parsed
// as HTML, so this is safe for nicknames.
export function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

// Disables `button` while `task` runs, so a double tap can't submit twice.
export async function busy(button, task) {
  if (button.disabled) return;
  button.disabled = true;
  try {
    return await task();
  } finally {
    button.disabled = false;
  }
}

// A short message at the bottom of the screen.
let toastTimer;
export function toast(text) {
  let node = $('toast');
  if (!node) {
    node = el('div', 'toast');
    node.id = 'toast';
    node.setAttribute('role', 'status');
    document.body.append(node);
  }
  node.textContent = text;
  node.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { node.hidden = true; }, 4000);
}

// A bar at the top saying the page may be out of date.
// Returns the `onConnection` callback for keepFresh.
export function connectionBanner(text) {
  const node = el('div', 'conn', text);
  node.setAttribute('role', 'status');
  node.hidden = true;
  document.body.prepend(node);
  return (ok) => { node.hidden = ok; };
}
