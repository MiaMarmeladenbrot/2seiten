import { useState } from 'react';
import type { Book } from '../lib/types';
import { paletteFor } from '../lib/palette';
import { coverUrlFor } from '../lib/covers';

interface Props {
  book: Book;
  className?: string;
}

export function BookCover({ book, className = 'cover' }: Props) {
  const { bg, fg } = paletteFor(book);
  const [imageBroken, setImageBroken] = useState(false);
  const coverUrl = imageBroken ? undefined : coverUrlFor(book);
  return (
    <div
      className={`${className}${coverUrl ? ' cover-photo' : ''}`}
      style={{ background: bg, color: fg }}
    >
      {coverUrl ? (
        <img
          className="cover-image"
          src={coverUrl}
          alt={`Buchcover von „${book.title}“`}
          loading="lazy"
          onError={() => setImageBroken(true)}
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
  );
}

export function MiniCover({ book }: { book: Book }) {
  const { bg } = paletteFor(book);
  const coverUrl = coverUrlFor(book);
  return (
    <span className="mini-cover" style={{ background: bg }}>
      {coverUrl && <img src={coverUrl} alt="" loading="lazy" />}
    </span>
  );
}
