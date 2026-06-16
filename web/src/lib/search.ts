import type { Book, Filters } from './types';

// Stand-in for the upcoming embedding model (transformers.js + multilingual MiniLM).
// When the real vector index is wired in, its output replaces this function —
// the callers (`unifiedSearch`, `applyFilters`) stay identical.
// NOTE: the keyword strings stay German on purpose — they match German queries and
// German episode/topic content.
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

function moodSearch(query: string, books: Book[]): Book[] {
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

// Hybrid: first substring hits on title/author (top results),
// then semantic hits on topic/episode — deduplicated, exact matches first.
function unifiedSearch(query: string, books: Book[]): Book[] {
  const q = query.trim();
  if (!q) return books;
  const qL = q.toLowerCase();
  const exact = books.filter(
    (b) => b.title.toLowerCase().includes(qL) || b.author.toLowerCase().includes(qL),
  );
  const semantic = moodSearch(q, books);
  const seen = new Set(exact.map((b) => b.title + '|' + b.author));
  const combined = [...exact];
  for (const b of semantic) {
    const key = b.title + '|' + b.author;
    if (!seen.has(key)) {
      combined.push(b);
      seen.add(key);
    }
  }
  return combined;
}

export function applyFilters(books: Book[], filters: Filters): Book[] {
  let list = filters.search ? unifiedSearch(filters.search, books) : books;
  if (filters.recommender !== 'alle') {
    list = list.filter((b) => b.recommended_by === filters.recommender);
  }
  if (filters.theme) list = list.filter((b) => b.topic === filters.theme);
  if (filters.year) list = list.filter((b) => b.year === filters.year);
  return list;
}
