import raw from '../../../data/books.json';
import type { Book, Recommender, Role } from '../lib/types';

interface RawEpisode {
  guid: string;
  title: string;
  published: string;
  topic: string;
  page_url?: string;
  ard_url?: string;
  audio_url?: string;
  books: {
    title: string;
    author: string;
    recommended_by: Recommender;
    role: Role;
    quote?: string | null;
  }[];
}

interface RawBooksJson {
  metadata: {
    total_episodes: number;
    total_books: number;
  };
  episodes: RawEpisode[];
}

const data = raw as unknown as RawBooksJson;

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const unslugged: Omit<Book, 'slug'>[] = data.episodes.flatMap((ep) =>
  ep.books.map((b) => ({
    key: `${b.title}|${b.author}`,
    title: b.title,
    author: b.author,
    recommended_by: b.recommended_by,
    role: b.role,
    quote: b.quote ?? null,
    episode_guid: ep.guid,
    episode_title: ep.title,
    topic: ep.topic,
    published: ep.published,
    year: ep.published.slice(0, 4),
    page_url: ep.page_url ?? '',
    ard_url: ep.ard_url ?? ep.page_url ?? '',
  })),
);

const BOOKS_PER_TITLE_SLUG = unslugged.reduce<Record<string, number>>((acc, b) => {
  const slug = slugify(b.title);
  acc[slug] = (acc[slug] ?? 0) + 1;
  return acc;
}, {});

export const BOOKS: Book[] = unslugged.map((b) => {
  const titleSlug = slugify(b.title);
  const surname = b.author.split(/\s+/).pop() ?? '';
  const slug = BOOKS_PER_TITLE_SLUG[titleSlug] > 1 ? `${titleSlug}-${slugify(surname)}` : titleSlug;
  return { ...b, slug };
});

export const BOOK_BY_SLUG = new Map(BOOKS.map((b) => [b.slug, b]));
export const BOOK_BY_KEY = new Map(BOOKS.map((b) => [b.key, b]));

const BOOKS_PER_TOPIC = BOOKS.reduce<Record<string, number>>((acc, b) => {
  acc[b.topic] = (acc[b.topic] ?? 0) + 1;
  return acc;
}, {});

export const THEMES: { topic: string; count: number }[] = Object.entries(BOOKS_PER_TOPIC)
  .map(([topic, count]) => ({ topic, count }))
  .sort((a, b) => a.topic.toLowerCase().localeCompare(b.topic.toLowerCase()));

export const YEARS: string[] = [...new Set(BOOKS.map((b) => b.year))].sort().reverse();

export const META = {
  totalBooks: data.metadata.total_books,
  totalEpisodes: data.metadata.total_episodes,
  firstYear: YEARS[YEARS.length - 1],
};
