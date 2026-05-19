import type { Book } from '../lib/types';
import { paletteFor } from '../lib/palette';

interface Props {
  book: Book;
}

function Avatar({ empfehler }: { empfehler: Book['empfohlen_von'] }) {
  if (empfehler === 'Christine') {
    return (
      <span className="avatar-wrap">
        <span className="avatar avatar-c">C</span>
      </span>
    );
  }
  if (empfehler === 'Mona') {
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
  return (
    <article className="book">
      <div className="cover" style={{ background: bg, color: fg }}>
        <div className="cover-mark">Zwei Seiten</div>
        <div className="cover-title">{book.titel}</div>
        <div className="cover-foot">
          <div className="cover-rule" />
          <div className="cover-author">{book.autor}</div>
        </div>
      </div>
      <h3 className="book-title">{book.titel}</h3>
      <p className="book-author">{book.autor}</p>
      <p className="book-meta">
        <Avatar empfehler={book.empfohlen_von} />
        <span className="book-thema">Folge „{book.thema}"</span>
      </p>
    </article>
  );
}
