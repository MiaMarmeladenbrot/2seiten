import type { Book } from '../lib/types';
import { BookCard } from './BookCard';

interface Props {
  books: Book[];
}

export function BookGrid({ books }: Props) {
  if (books.length === 0) {
    return (
      <main className="grid">
        <div className="empty-state">Keine Bücher gefunden. Versuch einen anderen Filter.</div>
      </main>
    );
  }
  return (
    <main className="grid">
      {books.map((b, i) => (
        <BookCard key={`${b.titel}|${b.autor}|${i}`} book={b} />
      ))}
    </main>
  );
}
