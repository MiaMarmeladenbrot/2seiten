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
const SIMILAR_PATH = resolve(here, '../src/data/similar.json');
const SIMILAR_COUNT = 3;
const SIMILAR_BY_HAND = {
  'Der alte Mann und der Bär|Janosch': [
    'Mein Freund Rilke|Melanie Garanin',
    'Nils. Von Tod und Wut. Und von Mut|Melanie Garanin',
    'Frankie|Jochen Gutsch',
  ],
};

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

const GENERIC_GENRES = new Set([
  'Fiktionale Darstellung',
  'Erzählende Literatur',
  'Erzählende Literatur: Gegenwartsliteratur ab 1945',
]);

function bookLikenessText(book, detail) {
  const keywords = detail?.keywords ?? [];
  const genres = (detail?.genre ?? []).filter((genre) => !GENERIC_GENRES.has(genre));
  const subjects = (detail?.thema ?? [])
    .filter((entry) => /^[A-Z]/.test(entry.code) && !entry.code.startsWith('FBA'))
    .map((entry) => entry.label.replace('Belletristik: Themen, Stoffe, Motive: ', ''));
  return [
    book.title,
    book.quote,
    [...genres, ...subjects].join(', '),
    keywords.slice(0, KEYWORD_COUNT).join(', '),
  ]
    .filter(Boolean)
    .join('. ');
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
        guid: ep.guid,
        text: bookIndexText(book, ep, description, keywords),
        likenessText: bookLikenessText(book, details[keyOf(book)]),
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
  const likenessVectors = {};
  const BATCH = 32;
  for (let i = 0; i < items.length; i += BATCH) {
    const batch = items.slice(i, i + BATCH);
    const out = await extract(
      batch.map((it) => it.text),
      { pooling: 'mean', normalize: true },
    );
    const rows = out.tolist();
    const likeness = (
      await extract(
        batch.map((it) => it.likenessText),
        { pooling: 'mean', normalize: true },
      )
    ).tolist();
    batch.forEach((it, j) => {
      // round to 6 decimals → smaller JSON, quality stays the same
      vectors[it.key] = rows[j].map((n) => Math.round(n * 1e6) / 1e6);
      likenessVectors[it.key] = likeness[j];
    });
    console.log(`  ${Math.min(i + BATCH, items.length)}/${items.length}`);
  }

  const dim = Object.values(vectors)[0].length;
  const payload = { model: MODEL, dim, vectors };
  writeFileSync(OUT_PATH, JSON.stringify(payload));
  console.log(`Written: ${OUT_PATH}`);
  console.log(`  ${Object.keys(vectors).length} vectors of ${dim} numbers each`);

  writeFileSync(SIMILAR_PATH, JSON.stringify(nearestNeighbours(items, likenessVectors), null, 1));
  console.log(`Written: ${SIMILAR_PATH}`);
  console.log(`  ${SIMILAR_COUNT} similar books each, never from the same episode`);
}

function nearestNeighbours(items, vectors) {
  const dot = (a, b) => a.reduce((sum, x, i) => sum + x * b[i], 0);
  const similar = {};
  const known = new Set(items.map((item) => item.key));
  for (const [key, picks] of Object.entries(SIMILAR_BY_HAND)) {
    const unknown = [key, ...picks].filter((k) => !known.has(k));
    if (unknown.length)
      throw new Error(`SIMILAR_BY_HAND names unknown books: ${unknown.join(', ')}`);
  }
  for (const item of items) {
    if (SIMILAR_BY_HAND[item.key]) {
      similar[item.key] = SIMILAR_BY_HAND[item.key];
      continue;
    }
    similar[item.key] = items
      .filter((other) => other.guid !== item.guid && other.key !== item.key)
      .map((other) => ({ key: other.key, score: dot(vectors[item.key], vectors[other.key]) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, SIMILAR_COUNT)
      .map((other) => other.key);
  }
  return similar;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
