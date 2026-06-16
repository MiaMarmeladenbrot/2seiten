// Builds the book vectors ONCE at site-build time.
// Reads data/books.json, runs each book's text through the model and writes
// web/src/data/embeddings.json. In the browser only the search query is embedded
// live and compared against these vectors (see lib/embeddings.ts).
//
// Usage:  node scripts/build_embeddings.mjs   (from the web/ folder)

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { pipeline } from '@huggingface/transformers';

// IMPORTANT: exactly the same model as in the browser (lib/embeddings.ts),
// otherwise query and book vectors won't match.
const MODEL = 'Xenova/paraphrase-multilingual-MiniLM-L12-v2';

const here = dirname(fileURLToPath(import.meta.url));
const BOOKS_PATH = resolve(here, '../../data/books.json');
const OUT_PATH = resolve(here, '../src/data/embeddings.json');

// Indexing text per book — what the model "reads".
// Labels stay German on purpose: the content and the queries are German, so
// German labels give the multilingual model the best semantic match.
function bookText(book, episode) {
  return [
    `Thema: ${episode.topic}`,
    `Buch: ${book.title} von ${book.author}`,
    `Empfohlen von: ${book.recommended_by}`,
    `Folge: ${episode.title}`,
  ].join('\n');
}

// Stable key, identical to the one used in the browser (title|author).
const keyOf = (book) => `${book.title}|${book.author}`;

async function main() {
  const data = JSON.parse(readFileSync(BOOKS_PATH, 'utf8'));

  const items = [];
  for (const ep of data.episodes) {
    for (const book of ep.books) {
      items.push({ key: keyOf(book), text: bookText(book, ep) });
    }
  }
  console.log(`Read ${items.length} books from books.json`);

  console.log(`Loading model ${MODEL} … (download on first run, cached afterwards)`);
  const extract = await pipeline('feature-extraction', MODEL);

  // Run through the model in small batches — mean-pooled + L2-normalized,
  // so that cosine similarity is later just a dot product.
  const vectors = {};
  const BATCH = 32;
  for (let i = 0; i < items.length; i += BATCH) {
    const batch = items.slice(i, i + BATCH);
    const out = await extract(
      batch.map((it) => it.text),
      { pooling: 'mean', normalize: true },
    );
    const rows = out.tolist();
    batch.forEach((it, j) => {
      // round to 6 decimals → smaller JSON, quality stays the same
      vectors[it.key] = rows[j].map((n) => Math.round(n * 1e6) / 1e6);
    });
    console.log(`  ${Math.min(i + BATCH, items.length)}/${items.length}`);
  }

  const dim = Object.values(vectors)[0].length;
  const payload = { model: MODEL, dim, vectors };
  writeFileSync(OUT_PATH, JSON.stringify(payload));
  console.log(`Written: ${OUT_PATH}`);
  console.log(`  ${Object.keys(vectors).length} vectors of ${dim} numbers each`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
