// Small DOM helpers shared by all pages.
import { COPY } from './copy.js';

export const $ = (id) => document.getElementById(id);

// Shows the <section class="screen"> with this id and hides the others.
export function showScreen(id) {
  document.querySelectorAll('.screen').forEach((s) => { s.hidden = s.id !== id; });
  fitFirstScreens();
}

// "Scroll down for…" labels. A long screen's .first-screen part is stretched to the phone's
// height, so its label sits at the bottom edge and the next section starts just below it.
// The label is hidden instead when everything fits, or when stretching would leave a big
// empty gap (tall screens like an iPad, where the next section is plainly visible). A part
// marked data-fill has a card that grows into the space, so it never leaves a gap.
// The height is read once at load (browser bars showing) and again only when the width
// changes, because iPhone Safari resizes the window while you scroll.
let screenHeight = innerHeight;
let screenWidth = innerWidth;

export function fitFirstScreens() {
  for (const first of document.querySelectorAll('.first-screen')) {
    if (!first.offsetParent) continue; // hidden
    const label = first.querySelector('.next');
    first.style.minHeight = '';
    label.hidden = false;
    const top = first.getBoundingClientRect().top + scrollY;
    const height = screenHeight - top - 12;
    const gap = first.hasAttribute('data-fill') ? 0 : height - first.offsetHeight;
    // Also hidden when this part starts below the first screen (e.g. the pet under the Finish card)
    if (document.documentElement.scrollHeight <= screenHeight || gap > screenHeight * 0.4 || top >= screenHeight) {
      label.hidden = true;
      continue;
    }
    first.style.minHeight = `${height}px`;
  }
}

addEventListener('resize', () => {
  if (innerWidth === screenWidth) return;
  screenWidth = innerWidth;
  screenHeight = innerHeight;
  fitFirstScreens();
});
document.fonts?.ready.then(fitFirstScreens);

// A label scrolls to the section named in its data-to.
document.addEventListener('click', (e) => {
  const label = e.target.closest('.next');
  if (!label) return;
  const smooth = !matchMedia('(prefers-reduced-motion: reduce)').matches;
  $(label.dataset.to)?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
});

// Creates an element with an optional class and text. Text is never parsed
// as HTML, so this is safe for nicknames.
export function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

// The 3 prize slots (1st, 2nd, 3rd), the same on the phone, the iPad and admin: who got it,
// who's being called now, or still waiting. `names` maps winner ids to nicknames.
export function prizeSlots(state, prize, calling, names) {
  return [1, 2, 3].map((n) => {
    const given = n <= state.winners.length;
    const now = n === prize;
    const name = given ? names.get(state.winners[n - 1]) ?? COPY.slot.removed
      : now ? calling?.nickname ?? COPY.slot.nobody : COPY.slot.next;
    const status = given ? COPY.slot.given : now ? (calling ? COPY.slot.calling : '') : COPY.slot.waiting;
    const slot = el('div', `prize p${n}${now ? ' now' : ''}`);
    slot.append(el('div', 'medal', COPY.place(n)), el('b', '', name), el('span', '', status));
    return slot;
  });
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
