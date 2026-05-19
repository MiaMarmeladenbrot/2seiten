export type Empfehler = 'Christine' | 'Mona' | 'beide';
export type Rolle = 'Hauptempfehlung' | 'Zusatzempfehlung';

export interface Book {
  titel: string;
  autor: string;
  empfohlen_von: Empfehler;
  rolle: Rolle;
  folge_titel: string;
  thema: string;
  jahr: string;
  page_url: string;
}

export interface Filters {
  search: string;
  empfehler: 'alle' | Empfehler;
  theme: string;
  year: string;
}
