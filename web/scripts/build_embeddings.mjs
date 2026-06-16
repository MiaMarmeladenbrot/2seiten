// Baut die Buch-Vektoren EINMALIG beim Bauen der Seite.
// Liest data/books.json, schickt jeden Buch-Text durchs Modell und schreibt
// web/src/data/embeddings.json. Im Browser wird dann nur noch die Suchanfrage
// live embeddet und gegen diese Vektoren verglichen (siehe lib/embeddings.ts).
//
// Aufruf:  node scripts/build_embeddings.mjs   (aus dem web/-Ordner)

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { pipeline } from '@huggingface/transformers';

// WICHTIG: exakt dasselbe Modell wie im Browser (lib/embeddings.ts), sonst
// passen Anfrage- und Buch-Vektoren nicht zusammen.
const MODEL = 'Xenova/paraphrase-multilingual-MiniLM-L12-v2';

const here = dirname(fileURLToPath(import.meta.url));
const BOOKS_PATH = resolve(here, '../../data/books.json');
const OUT_PATH = resolve(here, '../src/data/embeddings.json');

// Indexier-Text pro Buch — das, was das Modell "liest".
function bookText(book, episode) {
  return [
    `Thema: ${episode.thema}`,
    `Buch: ${book.titel} von ${book.autor}`,
    `Empfohlen von: ${book.empfohlen_von}`,
    `Folge: ${episode.title}`,
  ].join('\n');
}

// Stabiler Schlüssel, identisch zu dem im Browser (titel|autor).
const keyOf = (book) => `${book.titel}|${book.autor}`;

async function main() {
  const data = JSON.parse(readFileSync(BOOKS_PATH, 'utf8'));

  const items = [];
  for (const ep of data.episodes) {
    for (const book of ep.books) {
      items.push({ key: keyOf(book), text: bookText(book, ep) });
    }
  }
  console.log(`${items.length} Bücher gelesen aus books.json`);

  console.log(`Lade Modell ${MODEL} … (beim ersten Mal Download, danach Cache)`);
  const extract = await pipeline('feature-extraction', MODEL);

  // In kleinen Batches durchs Modell — mean-pooling + L2-normalisiert,
  // damit Kosinus-Ähnlichkeit später ein simples Skalarprodukt ist.
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
      // auf 6 Nachkommastellen runden → kleinere JSON, Qualität bleibt
      vectors[it.key] = rows[j].map((n) => Math.round(n * 1e6) / 1e6);
    });
    console.log(`  ${Math.min(i + BATCH, items.length)}/${items.length}`);
  }

  const dim = Object.values(vectors)[0].length;
  const payload = { model: MODEL, dim, vectors };
  writeFileSync(OUT_PATH, JSON.stringify(payload));
  console.log(`Geschrieben: ${OUT_PATH}`);
  console.log(`  ${Object.keys(vectors).length} Vektoren à ${dim} Zahlen`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
