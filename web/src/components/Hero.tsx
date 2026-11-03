import { META } from '../data/books';

const PODCAST_URL = 'https://www.ardsounds.de/sendung/zwei-seiten-der-podcast-ueber-buecher-oder-wdr/urn:ard:show:d02b9020cacfb644/';

export function Hero() {
  return (
    <header className="hero">
      <h1>Zwei Seiten</h1>
      <div className="hero-rule" />
      <p className="hero-sub">
        Die inoffizielle Bibliothek{' '}
        <span className="nowrap">
          zum{' '}
          <a href={PODCAST_URL} target="_blank" rel="noopener noreferrer">Podcast</a>
        </span>
      </p>
      <p className="hero-hosts">
        mit <span className="nowrap">Mona Ameziane</span> &{' '}
        <span className="nowrap">Christine Westermann</span>
      </p>
      <p className="hero-meta">
        <span className="nowrap">{META.totalBooks} Bücher</span> &middot;{' '}
        <span className="nowrap">{META.totalEpisodes} Folgen</span> &middot;{' '}
        <span className="nowrap">seit {META.firstYear}</span>
      </p>
    </header>
  );
}
