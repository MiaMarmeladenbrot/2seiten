import { META } from '../data/books';

const PODCAST_URL = 'https://www.ardsounds.de/sendung/zwei-seiten-der-podcast-ueber-buecher-oder-wdr/urn:ard:show:d02b9020cacfb644/';

export function Hero() {
  return (
    <header className="hero">
      <h1>Zwei Seiten</h1>
      <div className="hero-rule" />
      <p className="hero-sub">
        Die Bibliothek zum{' '}
        <a href={PODCAST_URL} target="_blank" rel="noopener noreferrer">Podcast</a>
      </p>
      <p className="hero-hosts">mit Mona Ameziane & Christine Westermann</p>
      <p className="hero-meta">
        {META.totalBooks} Bücher &middot; {META.totalEpisodes} Folgen &middot; seit {META.firstYear}
      </p>
    </header>
  );
}
