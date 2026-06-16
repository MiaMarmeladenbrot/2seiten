import type { Filters } from '../lib/types';

interface Props {
  filters: Filters;
  count: number;
  onClear: () => void;
}

export function Banner({ filters, count, onClear }: Props) {
  const hasFilter =
    !!filters.theme || !!filters.year || filters.recommender !== 'alle';
  const visible = !!filters.search || hasFilter;
  if (!visible) return null;

  const noun = count === 1 ? 'Buch' : 'Bücher';
  const parts: string[] = [];
  if (filters.recommender !== 'alle') parts.push(filters.recommender);
  if (filters.theme) parts.push(`Thema „${filters.theme}"`);
  if (filters.year) parts.push(filters.year);

  return (
    <div className="banner">
      <div className="banner-inner">
        <span className="banner-text">
          {count} {noun}
          {filters.search && (
            <>
              {' '}
              für <strong>„{filters.search}"</strong>
            </>
          )}
          {hasFilter && (
            <span style={{ color: 'var(--ink-soft)' }}> — {parts.join(' · ')}</span>
          )}
        </span>
        <button className="banner-clear" onClick={onClear}>
          × zurücksetzen
        </button>
      </div>
    </div>
  );
}
