import { useEffect, useId, useMemo, useRef, useState } from 'react';

export interface Option {
  value: string;
  label: string;
  count?: number;
}

interface Props {
  options: Option[];
  value: string;
  searchPlaceholder: string;
  emptyText: string;
  onPick: (value: string) => void;
  onDismiss: () => void;
}

const COMBINING_MARKS = /[̀-ͯ]/g;

const foldForMatching = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(COMBINING_MARKS, '');

function filterOptions(options: Option[], query: string): Option[] {
  const q = foldForMatching(query.trim());
  if (!q) return options;
  const hits = options.filter((o) => foldForMatching(o.label).includes(q));
  const startsWithQuery = (o: Option) => Number(foldForMatching(o.label).startsWith(q));
  return hits.sort((a, b) => startsWithQuery(b) - startsWithQuery(a));
}

export function OptionList({
  options,
  value,
  searchPlaceholder,
  emptyText,
  onPick,
  onDismiss,
}: Props) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const listId = useId();
  const optionId = (i: number) => `${listId}-opt-${i}`;

  const items = useMemo(() => filterOptions(options, query), [options, query]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const list = listRef.current;
    const row = list?.children[active] as HTMLElement | undefined;
    if (!list || !row) return;
    if (row.offsetTop < list.scrollTop) {
      list.scrollTop = row.offsetTop;
    } else if (row.offsetTop + row.offsetHeight > list.scrollTop + list.clientHeight) {
      list.scrollTop = row.offsetTop + row.offsetHeight - list.clientHeight;
    }
  }, [active, items]);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, items.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Home') {
      e.preventDefault();
      setActive(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      setActive(items.length - 1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const picked = items[active];
      if (picked) onPick(picked.value);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onDismiss();
    }
  }

  return (
    <>
      <div className="optlist-search">
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12 2l1.8 7.2L21 11l-7.2 1.8L12 20l-1.8-7.2L3 11l7.2-1.8z" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          autoComplete="off"
          placeholder={searchPlaceholder}
          aria-controls={listId}
          aria-expanded="true"
          aria-autocomplete="list"
          aria-activedescendant={items.length ? optionId(active) : undefined}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onKeyDown={onKeyDown}
        />
      </div>

      {items.length === 0 ? (
        <p className="optlist-empty">{emptyText}</p>
      ) : (
        <ul ref={listRef} className="optlist-items" id={listId} role="listbox">
          {items.map((o, i) => (
            <li
              key={o.value || '__all__'}
              id={optionId(i)}
              role="option"
              className="optlist-option"
              aria-selected={o.value === value}
              data-active={i === active}
              onMouseEnter={() => setActive(i)}
              onClick={() => onPick(o.value)}
            >
              <span>{o.label}</span>
              {o.count !== undefined && <span className="optlist-count">{o.count}</span>}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
