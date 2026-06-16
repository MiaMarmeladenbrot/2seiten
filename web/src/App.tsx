import { useEffect, useState } from 'react';
import { Hero } from './components/Hero';
import { SearchBar } from './components/SearchBar';
import { FilterBar } from './components/FilterBar';
import { Banner } from './components/Banner';
import { BookGrid } from './components/BookGrid';
import { BOOKS } from './data/books';
import { applyFilters, applyFiltersSync } from './lib/search';
import type { Book, Filters } from './lib/types';

const INITIAL: Filters = { search: '', recommender: 'alle', theme: '', year: '' };

function scrollToBanner() {
  document.getElementById('banner-anchor')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export default function App() {
  const [filters, setFilters] = useState<Filters>(INITIAL);
  const [results, setResults] = useState<Book[]>(() => applyFiltersSync(BOOKS, INITIAL));
  const [searching, setSearching] = useState(false);

  const update = (patch: Partial<Filters>) => setFilters((f) => ({ ...f, ...patch }));

  useEffect(() => {
    // Show the instant keyword result first — this is also the fallback that
    // stays visible while the embedding model loads on the first search.
    setResults(applyFiltersSync(BOOKS, filters));

    if (!filters.search.trim()) {
      setSearching(false);
      return;
    }

    let cancelled = false;
    setSearching(true);
    applyFilters(BOOKS, filters).then((semantic) => {
      if (cancelled) return;
      setResults(semantic);
      setSearching(false);
    });
    return () => {
      cancelled = true;
    };
  }, [filters]);

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
