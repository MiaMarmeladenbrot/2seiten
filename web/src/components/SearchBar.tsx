import { useEffect, useRef, useState } from 'react';

const PLACEHOLDERS = [
  'habe Fernweh…',
  '„Stanišić"…',
  'Buch für müde Abende…',
  '„Westermann"…',
  'brauche Mut…',
  'über Familie…',
  '„Le Tellier"…',
  'etwas Lustiges…',
  'Roman in Frankreich…',
];

const CHIPS: { label: string; query: string }[] = [
  { label: 'Fernweh', query: 'Fernweh und Reisen' },
  { label: 'Trost', query: 'Trost und Trauer' },
  { label: 'Mut', query: 'Mut und Kraft' },
  { label: 'Sommer', query: 'Sommer und Urlaub' },
  { label: 'Krise', query: 'Krise und Wendepunkte' },
  { label: 'Familie', query: 'Familie' },
  { label: 'Liebe', query: 'Liebe' },
  { label: 'Humor', query: 'Humor und etwas Lustiges' },
];

interface Props {
  value: string;
  onChange: (q: string) => void;
  onSubmit: () => void;
}

export function SearchBar({ value, onChange, onSubmit }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [placeholder, setPlaceholder] = useState(PLACEHOLDERS[0]);

  useEffect(() => {
    let idx = 0;
    const id = setInterval(() => {
      const el = inputRef.current;
      if (!el || document.activeElement === el || el.value) return;
      idx = (idx + 1) % PLACEHOLDERS.length;
      setPlaceholder(PLACEHOLDERS[idx]);
    }, 2800);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="search-wrap">
      <div className="search-box">
        <span className="search-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2l1.8 7.2L21 11l-7.2 1.8L12 20l-1.8-7.2L3 11l7.2-1.8z" />
          </svg>
        </span>
        <input
          ref={inputRef}
          className="search-input"
          type="text"
          placeholder={placeholder}
          autoComplete="off"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              (e.target as HTMLInputElement).blur();
              if (value.trim()) onSubmit();
            }
          }}
        />
        <button
          className="search-go"
          aria-label="Suchen"
          onClick={() => {
            if (value.trim()) onSubmit();
            else inputRef.current?.focus();
          }}
        >
          →
        </button>
      </div>
      <div className="mood-chips">
        {CHIPS.map((c) => (
          <button
            key={c.label}
            className="chip"
            onClick={() => {
              onChange(c.query);
              onSubmit();
            }}
          >
            {c.label}
          </button>
        ))}
      </div>
    </div>
  );
}
