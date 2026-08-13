import type { Book } from '../lib/types';
import { paletteFor } from '../lib/palette';
import coverFiles from '../data/covers.json';

const COVER_BY_BOOK = coverFiles as Record<string, string>;

interface Props {
  book: Book;
}

function Avatar({ recommender }: { recommender: Book['recommended_by'] }) {
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
  const { bg, fg } = paletteFor(book);
  const coverFile = COVER_BY_BOOK[`${book.title}|${book.author}`];
  return (
    <article className="book">
      <div
        className={`cover${coverFile ? ' cover-photo' : ''}`}
        style={{ background: bg, color: fg }}
      >
        {coverFile ? (
          <img
            className="cover-image"
            src={`${import.meta.env.BASE_URL}covers/${coverFile}`}
            alt={`Buchcover von „${book.title}"`}
            loading="lazy"
          />
        ) : (
          <>
            <div className="cover-mark">Zwei Seiten</div>
            <div className="cover-title">{book.title}</div>
            <div className="cover-foot">
              <div className="cover-rule" />
              <div className="cover-author">{book.author}</div>
            </div>
          </>
        )}
      </div>
      <h3 className="book-title">{book.title}</h3>
      <p className="book-author">{book.author}</p>
      <p className="book-meta">
        <Avatar recommender={book.recommended_by} />
        <span className="book-thema">Folge „{book.topic}"</span>
      </p>
    </article>
  );
}
