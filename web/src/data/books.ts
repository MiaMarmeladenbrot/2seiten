import raw from "../../../data/books.json";
import type { Book, Recommender, Role } from "../lib/types";

interface RawEpisode {
  guid: string;
  title: string;
  published: string;
  topic: string;
  page_url?: string;
  audio_url?: string;
  books: {
    title: string;
    author: string;
    recommended_by: Recommender;
    role: Role;
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

export const BOOKS: Book[] = data.episodes.flatMap((ep) =>
  ep.books.map((b) => ({
    title: b.title,
    author: b.author,
    recommended_by: b.recommended_by,
    role: b.role,
    episode_title: ep.title,
    topic: ep.topic,
    year: ep.published.slice(0, 4),
    page_url: ep.page_url ?? "",
  })),
);

export const THEMES: string[] = [...new Set(BOOKS.map((b) => b.topic))].sort(
  (a, b) => a.toLowerCase().localeCompare(b.toLowerCase()),
);

export const YEARS: string[] = [...new Set(BOOKS.map((b) => b.year))]
  .sort()
  .reverse();

export const META = {
  totalBooks: data.metadata.total_books,
  totalEpisodes: data.metadata.total_episodes,
  firstYear: YEARS[YEARS.length - 1],
};
