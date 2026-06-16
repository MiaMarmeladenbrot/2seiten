import type { Book } from './types';

// Same model as the build script (scripts/build_embeddings.mjs). If it changes
// here, the precomputed book vectors must be rebuilt or query and book vectors
// won't match.
const MODEL = 'Xenova/paraphrase-multilingual-MiniLM-L12-v2';

// Cosine-similarity cutoff: book vectors with a lower score than this are not
// considered a semantic match. Tune while testing (higher = stricter).
const MIN_SCORE = 0.3;

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
let extractorPromise: Promise<Extractor> | null = null;
function getExtractor(): Promise<Extractor> {
  if (!extractorPromise) {
    extractorPromise = import('@huggingface/transformers').then(
      async ({ pipeline }) =>
        (await pipeline('feature-extraction', MODEL)) as unknown as Extractor,
    );
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

// Embeds the query and ranks all books by cosine similarity (= dot product,
// since all vectors are L2-normalized). Returns books above MIN_SCORE, best first.
export async function semanticSearch(query: string, books: Book[]): Promise<Book[]> {
  const q = query.trim();
  if (!q) return [];

  const [extract, vectors] = await Promise.all([getExtractor(), getVectors()]);
  const out = await extract(q, { pooling: 'mean', normalize: true });
  const qvec = out.data;

  return books
    .map((book) => {
      const v = vectors[keyOf(book)];
      let score = -1;
      if (v) {
        let dot = 0;
        for (let i = 0; i < qvec.length; i++) dot += qvec[i] * v[i];
        score = dot;
      }
      return { book, score };
    })
    .filter((x) => x.score >= MIN_SCORE)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.book);
}
