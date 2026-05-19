import type { Filters } from '../lib/types';
import { THEMES, YEARS } from '../data/books';

interface Props {
  filters: Filters;
  onChange: (patch: Partial<Filters>) => void;
}

const SEGMENTS: { value: Filters['empfehler']; label: string }[] = [
  { value: 'alle', label: 'Alle' },
  { value: 'Christine', label: 'Christine' },
  { value: 'Mona', label: 'Mona' },
  { value: 'beide', label: 'Beide' },
];

export function FilterBar({ filters, onChange }: Props) {
  return (
    <>
      <div className="segmented" role="radiogroup" aria-label="Empfohlen von">
        <span className="seg-label">Empfohlen von</span>
        {SEGMENTS.map((s) => (
          <button
            key={s.value}
            className={`seg${filters.empfehler === s.value ? ' active' : ''}`}
            onClick={() => onChange({ empfehler: s.value })}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="dropdowns">
        <div className="dropdown">
          <span className="dropdown-label">Thema</span>
          <select
            value={filters.theme}
            onChange={(e) => onChange({ theme: e.target.value })}
          >
            <option value="">alle</option>
            {THEMES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div className="dropdown">
          <span className="dropdown-label">Jahr</span>
          <select value={filters.year} onChange={(e) => onChange({ year: e.target.value })}>
            <option value="">alle</option>
            {YEARS.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
      </div>
    </>
  );
}
