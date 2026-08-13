export type Recommender = 'Christine' | 'Mona' | 'both';
export type Role = 'Hauptempfehlung' | 'Zusatzempfehlung';

export interface Book {
  title: string;
  author: string;
  recommended_by: Recommender;
  role: Role;
  episode_title: string;
  topic: string;
  year: string;
  page_url: string;
}

export interface Filters {
  search: string;
  recommender: 'alle' | Recommender;
  theme: string;
  year: string;
}
