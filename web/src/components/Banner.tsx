import type { Filters } from '../lib/types';
import { RECOMMENDER_LABELS } from '../lib/labels';

interface Props {
  filters: Filters;
  count: number;
  searching: boolean;
  preparingModel: boolean;
  onClear: () => void;
}

export function Banner({ filters, count, searching, preparingModel, onClear }: Props) {
  const hasFilter = !!filters.theme || !!filters.year || filters.recommender !== 'alle';
  const visible = !!filters.search || hasFilter;
  if (!visible) return null;

  const noun = count === 1 ? 'Buch' : 'Bücher';
  const parts: string[] = [];
  if (filters.recommender !== 'alle') parts.push(RECOMMENDER_LABELS[filters.recommender]);
  if (filters.theme) parts.push(`Folge „${filters.theme}"`);
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
          {hasFilter && <span style={{ color: 'var(--ink-soft)' }}> — {parts.join(' · ')}</span>}
          {searching && (
            <span style={{ color: 'var(--ink-soft)' }}>
              {preparingModel
                ? ' · Stimmungs-Suche wird vorbereitet, beim ersten Mal dauert das einen Moment …'
                : ' · sucht …'}
            </span>
          )}
        </span>
        <button className="banner-clear" onClick={onClear}>
          × zurücksetzen
        </button>
      </div>
    </div>
  );
}
