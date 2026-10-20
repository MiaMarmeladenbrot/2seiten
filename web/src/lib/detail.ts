import pages from '../data/details.json';
import similar from '../data/similar.json';
import { BOOKS, BOOK_BY_KEY } from '../data/books';
import { paletteFor } from './palette';
import type { Book, BookPage, Recommender } from './types';

const PAGES = pages as Record<string, BookPage>;
const SIMILAR = similar as Record<string, string[]>;

export function pageOf(book: Book): BookPage | undefined {
  return PAGES[book.key];
}

export function sameEpisode(book: Book): Book[] {
  return BOOKS.filter((b) => b.episode_guid === book.episode_guid && b.key !== book.key);
}

export function similarTo(book: Book): Book[] {
  return (SIMILAR[book.key] ?? [])
    .map((key) => BOOK_BY_KEY.get(key))
    .filter((b): b is Book => b !== undefined);
}

const SPINE_HEIGHT_MIN = 124;
const SPINE_HEIGHT_SPREAD = 36;

export function spineOf(book: Book): { bg: string; fg: string; height: number } {
  const colours = PAGES[book.key]?.spine ?? paletteFor(book);
  let hash = 0;
  for (const char of book.key) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return { ...colours, height: SPINE_HEIGHT_MIN + (Math.abs(hash) % SPINE_HEIGHT_SPREAD) };
}

export function recommenderName(by: Recommender): string {
  return by === 'both' ? 'Christine und Mona' : by;
}

export function tipOf(by: Recommender): string {
  if (by === 'Christine') return 'Christines Tipp';
  if (by === 'Mona') return 'Monas Tipp';
  return 'Tipp von beiden';
}

export function episodeDate(published: string): string {
  return new Date(published).toLocaleDateString('de-DE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function imprint(page: BookPage): string {
  const where = [page.place, page.year].filter(Boolean).join(' ');
  return [page.publisher, where].filter(Boolean).join(', ');
}

export function translation(page: BookPage): string {
  if (page.translated_from && page.translators) {
    return `Aus dem ${page.translated_from} von ${page.translators}`;
  }
  if (page.translated_from) return `Aus dem ${page.translated_from}`;
  if (page.translators) return `Übersetzt von ${page.translators}`;
  return '';
}
