import type { Book } from './types';

export interface CoverPalette {
  bg: string;
  fg: string;
}

const PALETTES: CoverPalette[] = [
  { bg: '#D94A3D', fg: '#FAF4ED' },
  { bg: '#3E5852', fg: '#FAF4ED' },
  { bg: '#FAF4ED', fg: '#3E5852' },
  { bg: '#FAF4ED', fg: '#D94A3D' },
  { bg: '#2B1F1C', fg: '#EFD4C4' },
  { bg: '#EFD4C4', fg: '#2B1F1C' },
  { bg: '#C0413A', fg: '#F5EBDD' },
  { bg: '#F5EBDD', fg: '#C0413A' },
  { bg: '#2F4640', fg: '#F5EBDD' },
  { bg: '#F5EBDD', fg: '#2F4640' },
];

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

export function paletteFor(book: Pick<Book, 'title' | 'author'>): CoverPalette {
  return PALETTES[hashStr(book.title + book.author) % PALETTES.length];
}
