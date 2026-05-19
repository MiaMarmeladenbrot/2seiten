import type { Book, Filters } from './types';

// Stand-in fürs spätere Embedding-Modell (transformers.js + multilinguale MiniLM).
// Wenn der echte Vektor-Index drangeknüpft wird, ersetzt dessen Output diese
// Funktion — Aufrufer-Logik (`unifiedSearch`, `applyFilters`) bleibt identisch.
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
    const hay = (b.thema + ' ' + b.folge_titel + ' ' + b.titel + ' ' + b.autor).toLowerCase();
    let score = 0;
    for (const t of terms) {
      if (hay.includes(t)) score += b.thema.toLowerCase().includes(t) ? 3 : 1;
    }
    return { book: b, score };
  });
  return scored
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.book);
}

// Hybrid: erst Substring-Treffer auf Titel/Autor (Spitzentreffer),
// dann semantische Treffer auf Thema/Folge — dedupliziert, exact zuerst.
function unifiedSearch(query: string, books: Book[]): Book[] {
  const q = query.trim();
  if (!q) return books;
  const qL = q.toLowerCase();
  const exact = books.filter(
    (b) => b.titel.toLowerCase().includes(qL) || b.autor.toLowerCase().includes(qL),
  );
  const semantic = moodSearch(q, books);
  const seen = new Set(exact.map((b) => b.titel + '|' + b.autor));
  const combined = [...exact];
  for (const b of semantic) {
    const key = b.titel + '|' + b.autor;
    if (!seen.has(key)) {
      combined.push(b);
      seen.add(key);
    }
  }
  return combined;
}

export function applyFilters(books: Book[], filters: Filters): Book[] {
  let list = filters.search ? unifiedSearch(filters.search, books) : books;
  if (filters.empfehler !== 'alle') {
    list = list.filter((b) => b.empfohlen_von === filters.empfehler);
  }
  if (filters.theme) list = list.filter((b) => b.thema === filters.theme);
  if (filters.year) list = list.filter((b) => b.jahr === filters.year);
  return list;
}
