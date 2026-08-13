import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { Hero } from './components/Hero';
import { SearchBar } from './components/SearchBar';
import { FilterBar } from './components/FilterBar';
import { Banner } from './components/Banner';
import { BookGrid } from './components/BookGrid';
import { BOOKS } from './data/books';
import { applyFilters, applyFiltersSync } from './lib/search';
import { isModelReady, subscribeToModelReady } from './lib/embeddings';
import type { Book, Filters } from './lib/types';

const INITIAL: Filters = { search: '', recommender: 'alle', theme: '', year: '' };

function scrollToBanner() {
  document.getElementById('banner-anchor')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

interface SemanticResult {
  filters: Filters;
  books: Book[];
}

export default function App() {
  const [filters, setFilters] = useState<Filters>(INITIAL);
  const [semanticResult, setSemanticResult] = useState<SemanticResult | null>(null);

  const keywordResults = useMemo(() => applyFiltersSync(BOOKS, filters), [filters]);
  const semanticMatchesCurrentFilters =
    semanticResult !== null && semanticResult.filters === filters;

  const results = semanticMatchesCurrentFilters ? semanticResult.books : keywordResults;
  const searching = filters.search.trim() !== '' && !semanticMatchesCurrentFilters;

  const modelReady = useSyncExternalStore(subscribeToModelReady, isModelReady);
  const preparingModel = searching && !modelReady;

  const update = (patch: Partial<Filters>) => setFilters((f) => ({ ...f, ...patch }));

  useEffect(() => {
    if (!filters.search.trim()) return;

    let cancelled = false;
    applyFilters(BOOKS, filters)
      .then((books) => {
        if (!cancelled) setSemanticResult({ filters, books });
      })
      .catch((err) => {
        console.error('Semantic search unavailable, keeping keyword results:', err);
        if (!cancelled) setSemanticResult({ filters, books: keywordResults });
      });
    return () => {
      cancelled = true;
    };
  }, [filters, keywordResults]);

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
          searching={searching}
          preparingModel={preparingModel}
          onClear={() => setFilters(INITIAL)}
        />
      </div>

      <BookGrid books={results} />

      <footer>
        Fan-Projekt zum WDR-Podcast „Zwei Seiten" mit Christine Westermann und Mona Ameziane.
        <br />
        Stimmungs-Suche per Embedding-Modell — läuft komplett im Browser.
      </footer>
    </>
  );
}
