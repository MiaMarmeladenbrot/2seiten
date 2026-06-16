import type { Book, Filters } from './types';
import { semanticSearch } from './embeddings';

// Keyword stand-in used as the instant fallback while the embedding model loads.
// NOTE: the keyword strings stay German on purpose — they match German queries
// and German episode/topic content.
const MOOD_KEYWORDS: Record<string, string[]> = {
  fernweh: ['reisen', 'sommer', 'urlaub', 'ferne', 'meer', 'wege', 'horizont', 'sehnsucht'],
  trost: ['trost', 'trauer', 'abschied', 'wehmut', 'schmerz', 'verlust', 'einsamkeit'],
  mut: ['mut', 'kraft', 'hoffnung', 'aufbruch', 'anfänge', 'chancen', 'widerstand'],
  sommer: ['sommer', 'urlaub', 'reisen', 'meer', 'strand', 'sonne'],
  krise: ['krise', 'wendepunkt', 'umbruch', 'angst', 'depression', 'zweifel'],
  familie: ['familie', 'mutter', 'vater', 'kinder', 'herkunft', 'geschwister'],
  liebe: ['liebe', 'beziehung', 'sehnsucht', 'herz', 'paar'],
  humor: ['humor', 'spaß', 'lachen', 'komödie', 'witz', 'lustig', 'märchen'],
  trauer: ['trauer', 'tod', 'abschied', 'verlust', 'wehmut'],
  reisen: ['reisen', 'urlaub', 'sommer', 'ferne', 'meer', 'horizont'],
  urlaub: ['urlaub', 'sommer', 'reisen', 'meer'],
  ruhe: ['ruhe', 'stille', 'meditation', 'langsam', 'abend'],
};

const keyOf = (b: Book): string => b.title + '|' + b.author;

function keywordSearch(query: string, books: Book[]): Book[] {
  const q = query.toLowerCase().trim();
  if (!q) return [];
  const words = q.split(/\s+/).filter((w) => w.length > 2);
  const expanded = new Set<string>();
  for (const w of words) {
    expanded.add(w);
    for (const [key, syns] of Object.entries(MOOD_KEYWORDS)) {
      if (w.includes(key) || key.includes(w)) syns.forEach((s) => expanded.add(s));
    }
  }
  const terms = [...expanded];
  const scored = books.map((b) => {
    const hay = (b.topic + ' ' + b.episode_title + ' ' + b.title + ' ' + b.author).toLowerCase();
    let score = 0;
    for (const t of terms) {
      if (hay.includes(t)) score += b.topic.toLowerCase().includes(t) ? 3 : 1;
    }
    return { book: b, score };
  });
  return scored
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.book);
}

// Exact substring hits on title/author — these are the strongest signal and
// always rank first, ahead of fuzzy/semantic matches.
function exactMatches(query: string, books: Book[]): Book[] {
  const qL = query.trim().toLowerCase();
  return books.filter(
    (b) => b.title.toLowerCase().includes(qL) || b.author.toLowerCase().includes(qL),
  );
}

// Exact matches first, then the rest, deduplicated.
function merge(exact: Book[], rest: Book[]): Book[] {
  const seen = new Set(exact.map(keyOf));
  const combined = [...exact];
  for (const b of rest) {
    const k = keyOf(b);
    if (!seen.has(k)) {
      combined.push(b);
      seen.add(k);
    }
  }
  return combined;
}

// Recommender / topic / year filters — applied after the search step.
function narrow(list: Book[], filters: Filters): Book[] {
  if (filters.recommender !== 'alle') {
    list = list.filter((b) => b.recommended_by === filters.recommender);
  }
  if (filters.theme) list = list.filter((b) => b.topic === filters.theme);
  if (filters.year) list = list.filter((b) => b.year === filters.year);
  return list;
}

// Synchronous keyword search — instant, no model. Used for the immediate render
// and as the fallback shown while the embedding model is still loading.
export function applyFiltersSync(books: Book[], filters: Filters): Book[] {
  const q = filters.search.trim();
  const list = q ? merge(exactMatches(q, books), keywordSearch(q, books)) : books;
  return narrow(list, filters);
}

// Asynchronous semantic search — the real thing. Embeds the query in the browser
// and ranks by meaning. Callers (App) await this and replace the sync result.
export async function applyFilters(books: Book[], filters: Filters): Promise<Book[]> {
  const q = filters.search.trim();
  if (!q) return narrow(books, filters);
  const semantic = await semanticSearch(q, books);
  const list = merge(exactMatches(q, books), semantic);
  return narrow(list, filters);
}
