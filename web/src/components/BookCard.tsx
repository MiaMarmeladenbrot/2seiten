import type { Book } from '../lib/types';
import { bookHref, followInPlace } from '../lib/route';
import { BookCover } from './BookCover';

interface Props {
  book: Book;
}

export function Avatar({ recommender }: { recommender: Book['recommended_by'] }) {
  if (recommender === 'Christine') {
    return (
      <span className="avatar-wrap">
        <span className="avatar avatar-c">C</span>
      </span>
    );
  }
  if (recommender === 'Mona') {
    return (
      <span className="avatar-wrap">
        <span className="avatar avatar-m">M</span>
      </span>
    );
  }
  return (
    <span className="avatar-wrap both">
      <span className="avatar avatar-c">C</span>
      <span className="avatar avatar-m">M</span>
    </span>
  );
}

export function BookCard({ book }: Props) {
  return (
    <a
      className="book"
      href={bookHref(book.slug)}
      data-book-slug={book.slug}
      onClick={(event) => followInPlace(event, book.slug)}
    >
      <BookCover book={book} />
      <h3 className="book-title">{book.title}</h3>
      <p className="book-author">{book.author}</p>
      <p className="book-meta">
        <Avatar recommender={book.recommended_by} />
        <span className="book-thema">Folge „{book.topic}“</span>
      </p>
    </a>
  );
}
