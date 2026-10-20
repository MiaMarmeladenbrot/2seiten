export type Recommender = 'Christine' | 'Mona' | 'both';
export type Role = 'Hauptempfehlung' | 'Zusatzempfehlung';

export interface Book {
  key: string;
  slug: string;
  title: string;
  author: string;
  recommended_by: Recommender;
  role: Role;
  quote: string | null;
  episode_guid: string;
  episode_title: string;
  topic: string;
  published: string;
  year: string;
  page_url: string;
  ard_url: string;
}

export interface BookPage {
  publisher: string;
  place: string;
  year: string;
  pages: number | null;
  setting: string;
  original_title: string;
  translated_from: string;
  translators: string;
  publisher_url: string;
  spine?: { bg: string; fg: string };
}

export interface Filters {
  search: string;
  recommender: 'alle' | Recommender;
  theme: string;
  year: string;
}
