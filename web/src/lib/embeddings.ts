import type { Book } from './types';

// Same model as the build script (scripts/build_embeddings.mjs). If it changes
// here, the precomputed book vectors must be rebuilt or query and book vectors
// won't match.
const MODEL = 'Xenova/paraphrase-multilingual-MiniLM-L12-v2';

const CUTOFF_SIGMA = 2.0;
const ABSOLUTE_FLOOR = 0.35;
const MINIMUM_RESULTS = 10;

const MEDIUM_WORDS = new Set([
  'buch',
  'bücher',
  'buchtipp',
  'buchtipps',
  'roman',
  'romane',
  'lektüre',
]);

function dropMediumWords(query: string): string {
  const kept = query
    .split(/\s+/)
    .filter((w) => !MEDIUM_WORDS.has(w.toLowerCase().replace(/[^\wäöüß]/g, '')));
  return kept.length ? kept.join(' ') : query;
}

function matchGermanNounCapitalisation(query: string): string {
  return query.charAt(0).toUpperCase() + query.slice(1);
}

function prepareQuery(query: string): string {
  return matchGermanNounCapitalisation(dropMediumWords(query));
}

type VectorMap = Record<string, number[]>;

// Minimal shape we use from the transformers.js pipeline — avoids depending on
// the exact exported type names.
type Extractor = (
  text: string,
  opts: { pooling: 'mean'; normalize: boolean },
) => Promise<{ data: Float32Array }>;

// Both the model and the vector file are loaded lazily and only once — the first
// search pays the cost (model download ~30–50 MB, cached afterwards), browsing
// and filtering never load anything.
let modelReady = false;
const modelReadyListeners = new Set<() => void>();

export function subscribeToModelReady(listener: () => void): () => void {
  modelReadyListeners.add(listener);
  return () => {
    modelReadyListeners.delete(listener);
  };
}

export function isModelReady(): boolean {
  return modelReady;
}

let extractorPromise: Promise<Extractor> | null = null;
function getExtractor(): Promise<Extractor> {
  if (!extractorPromise) {
    extractorPromise = import('@huggingface/transformers')
      .then(
        async ({ pipeline }) =>
          (await pipeline('feature-extraction', MODEL)) as unknown as Extractor,
      )
      .then((extractor) => {
        modelReady = true;
        for (const listener of modelReadyListeners) listener();
        return extractor;
      });
  }
  return extractorPromise;
}

let vectorsPromise: Promise<VectorMap> | null = null;
function getVectors(): Promise<VectorMap> {
  if (!vectorsPromise) {
    vectorsPromise = import('../data/embeddings.json').then(
      (m) => (m.default as { vectors: VectorMap }).vectors,
    );
  }
  return vectorsPromise;
}

// Must match the key format written by build_embeddings.mjs.
const keyOf = (book: Book): string => `${book.title}|${book.author}`;

export async function semanticSearch(query: string, books: Book[]): Promise<Book[]> {
  const q = query.trim();
  if (!q) return [];

  const [extract, vectors] = await Promise.all([getExtractor(), getVectors()]);
  const out = await extract(prepareQuery(q), { pooling: 'mean', normalize: true });
  const qvec = out.data;

  const scored: { book: Book; score: number }[] = [];
  for (const book of books) {
    const v = vectors[keyOf(book)];
    if (!v) continue;
    let dot = 0;
    for (let i = 0; i < qvec.length; i++) dot += qvec[i] * v[i];
    scored.push({ book, score: dot });
  }
  if (!scored.length) return [];

  const mean = scored.reduce((sum, x) => sum + x.score, 0) / scored.length;
  const variance = scored.reduce((sum, x) => sum + (x.score - mean) ** 2, 0) / scored.length;
  const cutoffAboveThisQuerysOwnBaseline = mean + CUTOFF_SIGMA * Math.sqrt(variance);
  const cutoff = Math.max(ABSOLUTE_FLOOR, cutoffAboveThisQuerysOwnBaseline);

  const plausible = scored
    .filter((x) => x.score >= ABSOLUTE_FLOOR)
    .sort((a, b) => b.score - a.score);
  const aboveCutoff = plausible.filter((x) => x.score >= cutoff);

  const shown =
    aboveCutoff.length >= MINIMUM_RESULTS ? aboveCutoff : plausible.slice(0, MINIMUM_RESULTS);

  return shown.map((x) => x.book);
}
