import { META } from '../data/books';

export function Hero() {
  return (
    <header className="hero">
      <h1>Zwei Seiten</h1>
      <div className="hero-rule" />
      <p className="hero-sub">Die Bibliothek</p>
      <p className="hero-meta">
        {META.totalBooks} Bücher &middot; {META.totalEpisodes} Folgen &middot; seit {META.firstYear}
      </p>
    </header>
  );
}
