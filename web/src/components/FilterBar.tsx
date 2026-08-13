import type { Filters } from '../lib/types';
import { RECOMMENDER_LABELS } from '../lib/labels';
import { THEMES, YEARS } from '../data/books';

interface Props {
  filters: Filters;
  onChange: (patch: Partial<Filters>) => void;
}

const SEGMENT_ORDER: Filters['recommender'][] = ['alle', 'Christine', 'Mona', 'both'];
const SEGMENTS = SEGMENT_ORDER.map((value) => ({ value, label: RECOMMENDER_LABELS[value] }));

export function FilterBar({ filters, onChange }: Props) {
  return (
    <>
      <div className="segmented" role="radiogroup" aria-label="Empfohlen von">
        <span className="seg-label">Empfohlen von</span>
        {SEGMENTS.map((s) => (
          <button
            key={s.value}
            className={`seg${filters.recommender === s.value ? ' active' : ''}`}
            onClick={() => onChange({ recommender: s.value })}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="dropdowns">
        <div className="dropdown">
          <span className="dropdown-label">Folge</span>
          <select value={filters.theme} onChange={(e) => onChange({ theme: e.target.value })}>
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
