import { useEffect, useRef, useState } from 'react';
import type { Filters } from '../lib/types';
import { RECOMMENDER_LABELS } from '../lib/labels';
import { THEMES, YEARS } from '../data/books';
import { OptionList, type Option } from './OptionList';

interface Props {
  filters: Filters;
  count: number;
  countIsPending: boolean;
  onChange: (patch: Partial<Filters>) => void;
  onReset: () => void;
}

const RECOMMENDERS: Filters['recommender'][] = ['Christine', 'Mona', 'both'];

const THEME_OPTIONS: Option[] = [
  { value: '', label: 'Alle Folgen', count: THEMES.length },
  ...THEMES.map(({ topic, count }) => ({ value: topic, label: topic, count })),
];

function applyLabel(count: number, countIsPending: boolean): string {
  if (countIsPending) return 'Bücher anzeigen';
  if (count === 0) return 'Schließen';
  return `${count} ${count === 1 ? 'Buch' : 'Bücher'} anzeigen`;
}

function activeCount(filters: Filters): number {
  return (
    (filters.recommender !== 'alle' ? 1 : 0) + (filters.year ? 1 : 0) + (filters.theme ? 1 : 0)
  );
}

export function FilterMenu({ filters, count, countIsPending, onChange, onReset }: Props) {
  const [open, setOpen] = useState(false);
  const [pickingTheme, setPickingTheme] = useState(false);

  const wrapRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  const active = activeCount(filters);

  function close() {
    setOpen(false);
    setPickingTheme(false);
  }

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) close();
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  return (
    <>
      {open && <div className="filter-scrim" aria-hidden="true" />}
      <div
        className="filter-menu"
        ref={wrapRef}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && !pickingTheme) {
            close();
            toggleRef.current?.focus();
          }
        }}
      >
        <button
          ref={toggleRef}
          type="button"
          className={`filter-toggle${open ? ' is-open' : ''}${active ? ' has-filters' : ''}`}
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => (open ? close() : setOpen(true))}
        >
          <svg
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            aria-hidden="true"
          >
            <path d="M2 4.5h12M4.5 8h7M6.5 11.5h3" strokeLinecap="round" />
          </svg>
          Filter
          {active > 0 && <span className="filter-toggle-badge">{active}</span>}
        </button>

        {open && (
          <div className="filter-panel" role="dialog" aria-label="Filter">
            {pickingTheme ? (
              <>
                <button
                  type="button"
                  className="filter-back"
                  onClick={() => setPickingTheme(false)}
                  autoFocus
                >
                  <svg viewBox="0 0 6 10" fill="none" aria-hidden="true">
                    <path
                      d="M1 1l4 4-4 4"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                    />
                  </svg>
                  Folge
                </button>
                <OptionList
                  options={THEME_OPTIONS}
                  value={filters.theme}
                  searchPlaceholder="Folge suchen …"
                  emptyText="Keine Folge gefunden."
                  onPick={(theme) => {
                    onChange({ theme: filters.theme === theme ? '' : theme });
                    setPickingTheme(false);
                  }}
                  onDismiss={() => setPickingTheme(false)}
                />
              </>
            ) : (
              <>
                <div className="filter-group">
                  <span className="filter-group-label" id="filter-rec">
                    Empfohlen von
                  </span>
                  <div className="filter-choices" role="group" aria-labelledby="filter-rec">
                    {RECOMMENDERS.map((r) => (
                      <button
                        key={r}
                        type="button"
                        className="filter-choice"
                        aria-pressed={filters.recommender === r}
                        onClick={() =>
                          onChange({ recommender: filters.recommender === r ? 'alle' : r })
                        }
                      >
                        {RECOMMENDER_LABELS[r]}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="filter-group">
                  <span className="filter-group-label" id="filter-year">
                    Jahr
                  </span>
                  <div className="filter-choices" role="group" aria-labelledby="filter-year">
                    {YEARS.map((y) => (
                      <button
                        key={y}
                        type="button"
                        className="filter-choice"
                        aria-pressed={filters.year === y}
                        onClick={() => onChange({ year: filters.year === y ? '' : y })}
                      >
                        {y}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="filter-group">
                  <span className="filter-group-label">Folge</span>
                  <button
                    type="button"
                    className={`filter-drill${filters.theme ? ' is-set' : ''}`}
                    onClick={() => setPickingTheme(true)}
                  >
                    <span>{filters.theme || 'Alle Folgen'}</span>
                    <svg viewBox="0 0 6 10" fill="none" aria-hidden="true">
                      <path
                        d="M1 1l4 4-4 4"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                      />
                    </svg>
                  </button>
                </div>

                <div className="filter-foot">
                  {active > 0 && (
                    <button type="button" className="filter-reset" onClick={onReset}>
                      Filter zurücksetzen
                    </button>
                  )}
                  <button
                    type="button"
                    className="filter-apply"
                    onClick={() => {
                      close();
                      toggleRef.current?.focus();
                    }}
                  >
                    {applyLabel(count, countIsPending)}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </>
  );
}
