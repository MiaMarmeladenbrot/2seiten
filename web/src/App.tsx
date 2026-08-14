import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { Hero } from './components/Hero';
import { SearchBar } from './components/SearchBar';
import { FilterBar } from './components/FilterBar';
import { Banner } from './components/Banner';
import { BookGrid } from './components/BookGrid';
import { BOOKS } from './data/books';
import { narrow, rankBySearch, rankBySearchKeywordsOnlyFallback } from './lib/search';
import { isModelReady, subscribeToModelReady } from './lib/embeddings';
import type { Book, Filters } from './lib/types';

const INITIAL: Filters = { search: '', recommender: 'alle', theme: '', year: '' };
const SEARCH_DEBOUNCE_MS = 250;

function scrollToBanner() {
  document.getElementById('banner-anchor')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function useDebounced(value: string, delay: number): string {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setSettled(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return value === '' ? '' : settled;
}

interface Ranking {
  query: string;
  books: Book[];
}

export default function App() {
  const [filters, setFilters] = useState<Filters>(INITIAL);
  const [ranking, setRanking] = useState<Ranking | null>(null);

  const query = filters.search.trim();
  const settledQuery = useDebounced(query, SEARCH_DEBOUNCE_MS);
  const rankingIsForSettledQuery = ranking !== null && ranking.query === settledQuery;

  const searching = query !== '' && !(rankingIsForSettledQuery && settledQuery === query);
  const ranked = settledQuery === '' ? BOOKS : (ranking?.books ?? null);
  const results = useMemo(() => (ranked ? narrow(ranked, filters) : []), [ranked, filters]);
  const awaitingFirstRanking = ranked === null;

  const modelReady = useSyncExternalStore(subscribeToModelReady, isModelReady);
  const preparingModel = searching && !modelReady;

  const update = (patch: Partial<Filters>) => setFilters((f) => ({ ...f, ...patch }));

  useEffect(() => {
    if (!settledQuery) return;

    let cancelled = false;
    rankBySearch(settledQuery, BOOKS)
      .then((books) => {
        if (!cancelled) setRanking({ query: settledQuery, books });
      })
      .catch((err) => {
        console.error('Semantic search unavailable, falling back to keywords:', err);
        if (!cancelled) {
          setRanking({
            query: settledQuery,
            books: rankBySearchKeywordsOnlyFallback(settledQuery, BOOKS),
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [settledQuery]);

  return (
    <>
      <Hero />
      <section className="controls">
        <SearchBar
          value={filters.search}
          onChange={(search) => update({ search })}
          onSubmit={scrollToBanner}
        />
        <FilterBar filters={filters} onChange={update} />
      </section>

      <div id="banner-anchor">
        <Banner
          filters={filters}
          count={results.length}
          countIsPending={awaitingFirstRanking}
          searching={searching}
          preparingModel={preparingModel}
          onClear={() => setFilters(INITIAL)}
        />
      </div>

      <BookGrid books={results} loading={awaitingFirstRanking} stale={searching} />

      <footer>
        Fan-Projekt zum WDR-Podcast „Zwei Seiten" mit Christine Westermann und Mona Ameziane.
      </footer>
    </>
  );
}
