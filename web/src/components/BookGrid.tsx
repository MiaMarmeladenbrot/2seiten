import type { Book } from '../lib/types';
import { BookCard } from './BookCard';

const SKELETON_COUNT = 10;

interface Props {
  books: Book[];
  loading?: boolean;
  stale?: boolean;
}

export function BookGrid({ books, loading = false, stale = false }: Props) {
  if (loading) {
    return (
      <main className="grid" aria-busy="true">
        {Array.from({ length: SKELETON_COUNT }, (_, i) => (
          <div className="book-skeleton" key={i}>
            <div className="book-skeleton-cover shimmer" />
            <div className="book-skeleton-title shimmer" />
            <div className="book-skeleton-author shimmer" />
            <div className="book-skeleton-meta shimmer" />
          </div>
        ))}
      </main>
    );
  }

  if (books.length === 0) {
    return (
      <main className="grid">
        <div className="empty-state">Keine Bücher gefunden. Versuch einen anderen Filter.</div>
      </main>
    );
  }

  return (
    <main className={stale ? 'grid is-stale' : 'grid'}>
      {books.map((b, i) => (
        <BookCard key={`${b.title}|${b.author}|${i}`} book={b} />
      ))}
    </main>
  );
}
