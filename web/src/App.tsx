import { useMemo, useState } from 'react';
import { Hero } from './components/Hero';
import { SearchBar } from './components/SearchBar';
import { FilterBar } from './components/FilterBar';
import { Banner } from './components/Banner';
import { BookGrid } from './components/BookGrid';
import { BOOKS } from './data/books';
import { applyFilters } from './lib/search';
import type { Filters } from './lib/types';

const INITIAL: Filters = { search: '', recommender: 'alle', theme: '', year: '' };

function scrollToBanner() {
  document.getElementById('banner-anchor')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export default function App() {
  const [filters, setFilters] = useState<Filters>(INITIAL);

  const update = (patch: Partial<Filters>) => setFilters((f) => ({ ...f, ...patch }));
  const results = useMemo(() => applyFilters(BOOKS, filters), [filters]);

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
        <Banner filters={filters} count={results.length} onClear={() => setFilters(INITIAL)} />
      </div>

      <BookGrid books={results} />

      <footer>
        Fan-Projekt zum WDR-Podcast „Zwei Seiten" mit Christine Westermann und Mona Ameziane.
        <br />
        Stimmungs-Suche aktuell mit Stichwort-Map — Embedding-Backend folgt.
      </footer>
    </>
  );
}
