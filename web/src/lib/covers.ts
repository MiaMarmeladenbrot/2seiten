import type { Book } from './types';
import coverFiles from '../data/covers.json';

const COVER_BY_BOOK = coverFiles as Record<string, string>;

export function coverUrlFor(book: Pick<Book, 'title' | 'author'>): string | undefined {
  const file = COVER_BY_BOOK[`${book.title}|${book.author}`];
  return file ? `${import.meta.env.BASE_URL}covers/${file}` : undefined;
}
