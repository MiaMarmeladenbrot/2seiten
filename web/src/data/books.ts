import raw from "../../../data/books.json";
import type { Book, Empfehler, Rolle } from "../lib/types";

interface RawEpisode {
  guid: string;
  title: string;
  published: string;
  thema: string;
  page_url?: string;
  audio_url?: string;
  books: {
    titel: string;
    autor: string;
    empfohlen_von: Empfehler;
    rolle: Rolle;
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
    titel: b.titel,
    autor: b.autor,
    empfohlen_von: b.empfohlen_von,
    rolle: b.rolle,
    folge_titel: ep.title,
    thema: ep.thema,
    jahr: ep.published.slice(0, 4),
    page_url: ep.page_url ?? "",
  })),
);

export const THEMES: string[] = [...new Set(BOOKS.map((b) => b.thema))].sort(
  (a, b) => a.toLowerCase().localeCompare(b.toLowerCase()),
);

export const YEARS: string[] = [...new Set(BOOKS.map((b) => b.jahr))]
  .sort()
  .reverse();

export const META = {
  totalBooks: data.metadata.total_books,
  totalEpisodes: data.metadata.total_episodes,
  firstYear: YEARS[YEARS.length - 1],
};
