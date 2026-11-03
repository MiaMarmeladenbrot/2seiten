import { useSyncExternalStore } from 'react';
import type { Filters } from '../lib/types';
import { RECOMMENDER_LABELS } from '../lib/labels';
import { getModelLoadingPercent, subscribeToModelProgress } from '../lib/embeddings';

function ModelProgress() {
  const percent = useSyncExternalStore(subscribeToModelProgress, getModelLoadingPercent);
  return (
    <div
      className="banner-progress"
      role="progressbar"
      aria-label="Stimmungs-Suche wird geladen"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
    >
      <div className="banner-progress-fill" style={{ width: `${percent}%` }} />
    </div>
  );
}

interface Props {
  filters: Filters;
  count: number;
  countIsPending: boolean;
  searching: boolean;
  preparingModel: boolean;
  onClear: () => void;
}

export function Banner({
  filters,
  count,
  countIsPending,
  searching,
  preparingModel,
  onClear,
}: Props) {
  const hasFilter = !!filters.theme || !!filters.year || filters.recommender !== 'alle';
  const visible = !!filters.search || hasFilter;
  if (!visible) return null;

  const noun = count === 1 ? 'Buch' : 'Bücher';
  const parts: string[] = [];
  if (filters.recommender !== 'alle') parts.push(RECOMMENDER_LABELS[filters.recommender]);
  if (filters.theme) parts.push(`Folge „${filters.theme}“`);
  if (filters.year) parts.push(filters.year);

  return (
    <div className="banner">
      <div className="banner-inner">
        <span className="banner-text">
          {countIsPending ? noun : `${count} ${noun}`}
          {filters.search && (
            <>
              {' '}
              für <strong>„{filters.search}“</strong>
            </>
          )}
          {hasFilter && <span className="banner-soft"> ({parts.join(', ')})</span>}
          {searching && <span className="banner-soft">, sucht …</span>}
        </span>
        <button className="banner-clear" onClick={onClear}>
          × zurücksetzen
        </button>
        {preparingModel && <ModelProgress />}
      </div>
    </div>
  );
}
