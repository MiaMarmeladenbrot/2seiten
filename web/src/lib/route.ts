const BOOK_PATH = `${import.meta.env.BASE_URL}buch/`;

const listeners = new Set<() => void>();
let goingBack = false;

window.addEventListener('popstate', () => {
  goingBack = false;
});

function notify() {
  listeners.forEach((listener) => listener());
}

export function subscribeToRoute(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener('popstate', listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('popstate', listener);
  };
}

export function bookSlugFromLocation(): string | null {
  const path = window.location.pathname;
  if (!path.startsWith(BOOK_PATH)) return null;
  const slug = decodeURIComponent(path.slice(BOOK_PATH.length)).replace(/\/+$/, '');
  return slug || null;
}

export function bookHref(slug: string): string {
  return `${BOOK_PATH}${encodeURIComponent(slug)}`;
}

export function openBook(slug: string) {
  const replacing = bookSlugFromLocation() !== null;
  const state = { book: slug, openedInApp: replacing ? history.state?.openedInApp === true : true };
  if (replacing) history.replaceState(state, '', bookHref(slug));
  else history.pushState(state, '', bookHref(slug));
  notify();
}

export function followInPlace(
  event: {
    button: number;
    metaKey: boolean;
    ctrlKey: boolean;
    shiftKey: boolean;
    altKey: boolean;
    preventDefault: () => void;
  },
  slug: string,
) {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
    return;
  event.preventDefault();
  openBook(slug);
}

export function closeBook() {
  if (goingBack || bookSlugFromLocation() === null) return;
  if (history.state?.openedInApp) {
    goingBack = true;
    history.back();
    return;
  }
  history.replaceState(null, '', import.meta.env.BASE_URL);
  notify();
}
