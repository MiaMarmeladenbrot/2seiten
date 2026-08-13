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
const EPISODES_PATH = resolve(here, '../../data/episodes.json');
const DETAILS_PATH = resolve(here, '../../data/book_details.json');
const OUT_PATH = resolve(here, '../src/data/embeddings.json');

const DESCRIPTION_CHARS_WITHOUT_KEYWORDS = 400;
const DESCRIPTION_CHARS_WITH_KEYWORDS = 200;
const KEYWORD_COUNT = 10;

function bookIndexText(book, episode, episodeDescription, keywords) {
  const head = `${episode.topic}. ${book.title}. ${episode.title}`;
  if (!keywords.length) {
    return `${head}. ${episodeDescription.slice(0, DESCRIPTION_CHARS_WITHOUT_KEYWORDS)}`;
  }
  const terms = keywords.slice(0, KEYWORD_COUNT).join(', ');
  return `${head}. ${terms}. ${episodeDescription.slice(0, DESCRIPTION_CHARS_WITH_KEYWORDS)}`;
}

// Stable key, identical to the one used in the browser (title|author).
const keyOf = (book) => `${book.title}|${book.author}`;

async function main() {
  const data = JSON.parse(readFileSync(BOOKS_PATH, 'utf8'));
  const episodes = JSON.parse(readFileSync(EPISODES_PATH, 'utf8'));
  const descriptionByGuid = new Map(
    episodes.map((ep) => [ep.guid, ep.description_full_text || ep.description || '']),
  );

  const details = JSON.parse(readFileSync(DETAILS_PATH, 'utf8')).books;

  const items = [];
  const episodesWithoutDescription = new Set();
  let booksWithKeywords = 0;
  for (const ep of data.episodes) {
    const description = descriptionByGuid.get(ep.guid) ?? '';
    if (!description) episodesWithoutDescription.add(ep.title);
    for (const book of ep.books) {
      const keywords = details[keyOf(book)]?.keywords ?? [];
      if (keywords.length) booksWithKeywords++;
      items.push({
        key: keyOf(book),
        text: bookIndexText(book, ep, description, keywords),
      });
    }
  }
  console.log(`Read ${items.length} books from books.json`);
  console.log(
    `  ${booksWithKeywords} with DNB keywords, ${items.length - booksWithKeywords} on the episode description alone`,
  );
  if (episodesWithoutDescription.size > 0) {
    console.log(
      `  no episode description for ${episodesWithoutDescription.size} episode(s): ` +
        [...episodesWithoutDescription].slice(0, 5).join(' | '),
    );
  }

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
