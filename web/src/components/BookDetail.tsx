import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import type { Book } from '../lib/types';
import { bookHref, followInPlace } from '../lib/route';
import {
  episodeDate,
  imprint,
  pageOf,
  recommenderName,
  sameEpisode,
  similarTo,
  spineOf,
  tipOf,
  translation,
} from '../lib/detail';
import { BookCover, MiniCover } from './BookCover';
import { Avatar } from './BookCard';

const NARROW_BELOW = 760;
const COVER_RATIO = 63 / 100;
const LID_OPEN_MS = 1050;
const LID_CLOSE_MS = 850;
const PEEK = 22;
const NARROW_TOP = 72;
const NARROW_BOTTOM = 24;
const SWIPE_START_PX = 8;
const SWIPE_ZOOM = 0.94;
const PAGE_GLIDE_MS = 380;

interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface Layout extends Rect {
  narrow: boolean;
  pan: number;
}

interface Camera {
  x: number;
  zoom: number;
  page: 1 | 2;
  ready: boolean;
}

function layoutFor(viewWidth: number, viewHeight: number): Layout {
  const narrow = viewWidth < NARROW_BELOW;
  if (!narrow) {
    let height = Math.min(viewHeight - 96, 640);
    let width = Math.round(height * COVER_RATIO);
    if (2 * width > viewWidth - 64) {
      width = Math.floor((viewWidth - 64) / 2);
      height = Math.round(width / COVER_RATIO);
    }
    return {
      narrow,
      width,
      height,
      left: Math.round(viewWidth / 2),
      top: Math.round((viewHeight - height) / 2),
      pan: 0,
    };
  }
  const width = viewWidth - 2 * PEEK;
  const room = viewHeight - NARROW_TOP - NARROW_BOTTOM;
  const height = Math.min(room, Math.round(width / COVER_RATIO));
  return {
    narrow,
    width,
    height,
    left: PEEK + width,
    top: NARROW_TOP + Math.round((room - height) / 2),
    pan: width,
  };
}

function closedRect(layout: Layout): Rect {
  return {
    left: layout.left - layout.pan,
    top: layout.top,
    width: layout.width,
    height: layout.height,
  };
}

function tween(ms: number, step: (t: number) => void): Promise<void> {
  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  return new Promise((resolve) => {
    if (still || ms <= 0) {
      step(1);
      resolve();
      return;
    }
    const start = performance.now();
    const frame = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      step(t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
      if (t < 1) requestAnimationFrame(frame);
      else resolve();
    };
    requestAnimationFrame(frame);
  });
}

function aim(el: HTMLElement | null, camera: Camera, x: number, zoom = 1) {
  camera.x = x;
  camera.zoom = zoom;
  if (el) el.style.transform = `translateX(${x}px) scale(${zoom})`;
}

function glide(el: HTMLElement | null, camera: Camera, to: number, ms: number): Promise<void> {
  const fromX = camera.x;
  const fromZoom = camera.zoom;
  return tween(ms, (t) => aim(el, camera, fromX + (to - fromX) * t, fromZoom + (1 - fromZoom) * t));
}

function flipFrom(from: Rect, to: Rect): string {
  const sx = from.width / to.width;
  const sy = from.height / to.height;
  return `translate(${from.left - to.left}px, ${from.top - to.top}px) scale(${sx}, ${sy})`;
}

function play(
  el: Element | null,
  keyframes: Keyframe[],
  options: { duration: number; delay?: number; easing?: string },
): Promise<void> {
  if (!el) return Promise.resolve();
  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  return el
    .animate(keyframes, {
      easing: 'cubic-bezier(.2,.7,.2,1)',
      fill: 'both',
      ...options,
      duration: still ? 0 : options.duration,
      delay: still ? 0 : (options.delay ?? 0),
    })
    .finished.then(
      () => undefined,
      () => undefined,
    );
}

const FADE_IN: Keyframe[] = [{ opacity: 0 }, { opacity: 1 }];
const FADE_OUT: Keyframe[] = [{ opacity: 1 }, { opacity: 0 }];

function swingLid(
  lid: HTMLElement | null,
  shadeFront: HTMLElement | null,
  shadeBack: HTMLElement | null,
  open: boolean,
): Promise<unknown> {
  const duration = open ? LID_OPEN_MS : LID_CLOSE_MS;
  const half = duration / 2;
  const turn: Keyframe[] = [
    { transform: 'translateZ(1px) rotateY(0deg)' },
    { transform: 'translateZ(1px) rotateY(-180deg)' },
  ];
  const runs = [
    play(lid, open ? turn : [...turn].reverse(), {
      duration,
      easing: 'cubic-bezier(.55,.05,.3,1)',
    }),
    play(shadeFront, [{ opacity: open ? 0 : 0.45 }, { opacity: open ? 0.45 : 0 }], {
      duration: half,
      delay: open ? 0 : half,
      easing: 'linear',
    }),
    play(shadeBack, [{ opacity: open ? 0.45 : 0 }, { opacity: open ? 0 : 0.45 }], {
      duration: half,
      delay: open ? half : 0,
      easing: 'linear',
    }),
  ];
  return Promise.all(runs);
}

function cardCoverOf(slug: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-book-slug="${CSS.escape(slug)}"] .cover`);
}

function onScreen(el: HTMLElement | null): Rect | null {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width === 0 || r.bottom < 0 || r.top > window.innerHeight) return null;
  return { left: r.left, top: r.top, width: r.width, height: r.height };
}

function BookLink({
  book,
  kicker,
  withEpisode,
}: {
  book: Book;
  kicker?: string;
  withEpisode?: boolean;
}) {
  return (
    <a
      className="detail-link"
      href={bookHref(book.slug)}
      onClick={(event) => followInPlace(event, book.slug)}
    >
      <MiniCover book={book} />
      <span className="detail-link-text">
        {kicker && <span className="detail-kicker">{kicker}</span>}
        <span className="detail-link-title">{book.title}</span>
        <span className="detail-link-author">{book.author}</span>
        {withEpisode && (
          <span className="book-meta detail-link-meta">
            <Avatar recommender={book.recommended_by} />
            <span className="book-thema">Folge „{book.topic}“</span>
          </span>
        )}
      </span>
    </a>
  );
}

function Shelf({ books }: { books: Book[] }) {
  const [shown, setShown] = useState<Book | null>(null);
  return (
    <div className="shelf">
      <p className="detail-section">Außerdem in dieser Folge</p>
      <div className="shelf-row">
        {books.map((b) => {
          const spine = spineOf(b);
          const style = {
            height: spine.height,
            '--spine-bg': spine.bg,
            '--spine-fg': spine.fg,
          } as CSSProperties;
          return (
            <a
              key={b.key}
              className="spine"
              href={bookHref(b.slug)}
              style={style}
              aria-label={`${b.title} von ${b.author}`}
              onClick={(event) => followInPlace(event, b.slug)}
              onMouseEnter={() => setShown(b)}
              onMouseLeave={() => setShown(null)}
              onFocus={() => setShown(b)}
              onBlur={() => setShown(null)}
            >
              <span>{b.title}</span>
            </a>
          );
        })}
      </div>
      <div className="shelf-board" />
      <div className="shelf-peek" aria-hidden="true">
        {shown ? (
          <>
            <MiniCover book={shown} />
            <span className="detail-link-text">
              <span className="detail-link-title">{shown.title}</span>
              <span className="detail-link-author">{shown.author}</span>
            </span>
          </>
        ) : (
          <span className="shelf-hint">Auf einen Buchrücken zeigen</span>
        )}
      </div>
    </div>
  );
}

function OtherBooks({ books }: { books: Book[] }) {
  if (books.length === 1) {
    return (
      <BookLink book={books[0]} kicker={`${tipOf(books[0].recommended_by)} in derselben Folge`} />
    );
  }
  return <Shelf books={books} />;
}

function ListenLink({ book }: { book: Book }) {
  return (
    <a className="detail-listen" href={book.ard_url} target="_blank" rel="noopener noreferrer">
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path d="M4 2.5v11l9-5.5z" fill="currentColor" />
      </svg>
      Folge anhören
    </a>
  );
}

interface Props {
  book: Book;
  closing: boolean;
  onRequestClose: () => void;
  onClosed: () => void;
}

export function BookDetail({ book, closing, onRequestClose, onClosed }: Props) {
  const [layout] = useState(() => layoutFor(window.innerWidth, window.innerHeight));
  const backdropRef = useRef<HTMLDivElement>(null);
  const bookRef = useRef<HTMLDivElement>(null);
  const lidRef = useRef<HTMLDivElement>(null);
  const shadeFrontRef = useRef<HTMLDivElement>(null);
  const shadeBackRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const flatRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const cameraElRef = useRef<HTMLDivElement>(null);
  const cameraRef = useRef<Camera>({ x: -layout.pan, zoom: 1, page: 1, ready: false });
  const closingRef = useRef(false);

  const page = pageOf(book);
  const partners = sameEpisode(book);
  const alike = similarTo(book);
  const endpaper = book.recommended_by === 'Mona' ? 'var(--coral)' : 'var(--petrol)';

  useLayoutEffect(() => {
    let cancelled = false;
    const card = cardCoverOf(book.slug);
    const from = onScreen(card);
    if (card) card.style.visibility = 'hidden';
    const root = document.documentElement;
    root.classList.add('detail-open');
    const previousTitle = document.title;
    document.title = `${book.title} von ${book.author} (Zwei Seiten)`;

    const animated = [
      backdropRef.current,
      bookRef.current,
      lidRef.current,
      shadeFrontRef.current,
      shadeBackRef.current,
      pageRef.current,
      closeRef.current,
    ];
    const lid = lidRef.current;
    const flat = flatRef.current;
    const camera = cameraRef.current;

    (async () => {
      play(closeRef.current, FADE_IN, { duration: 340, delay: 600 });
      await Promise.all([
        play(backdropRef.current, FADE_IN, { duration: 340, easing: 'ease-out' }),
        from
          ? play(
              bookRef.current,
              [{ transform: flipFrom(from, closedRect(layout)) }, { transform: 'none' }],
              { duration: 640 },
            )
          : play(
              bookRef.current,
              [
                { opacity: 0, transform: 'scale(0.94)' },
                { opacity: 1, transform: 'none' },
              ],
              {
                duration: 420,
              },
            ),
      ]);
      if (cancelled || closingRef.current) return;
      play(pageRef.current, FADE_IN, {
        duration: 450,
        delay: LID_OPEN_MS * 0.35,
        easing: 'ease-out',
      });
      await Promise.all([
        swingLid(lid, shadeFrontRef.current, shadeBackRef.current, true),
        layout.pan ? glide(cameraElRef.current, camera, 0, LID_OPEN_MS) : null,
      ]);
      if (cancelled || closingRef.current) return;
      if (flat) flat.hidden = false;
      if (lid) lid.style.visibility = 'hidden';
      camera.page = 1;
      camera.ready = true;
      closeRef.current?.focus({ preventScroll: true });
    })();

    return () => {
      cancelled = true;
      animated.forEach((el) => el?.getAnimations().forEach((a) => a.cancel()));
      if (card) card.style.visibility = '';
      root.classList.remove('detail-open');
      document.title = previousTitle;
    };
  }, [book, layout]);

  useEffect(() => {
    if (!closing) return;
    closingRef.current = true;
    let cancelled = false;
    const lid = lidRef.current;
    const camera = cameraRef.current;
    camera.ready = false;
    if (flatRef.current) flatRef.current.hidden = true;
    if (lid) lid.style.visibility = '';

    (async () => {
      play(closeRef.current, FADE_OUT, { duration: 150 });
      play(pageRef.current, FADE_OUT, { duration: 250, easing: 'ease-in' });
      await Promise.all([
        swingLid(lid, shadeFrontRef.current, shadeBackRef.current, false),
        layout.pan ? glide(cameraElRef.current, camera, -layout.pan, LID_CLOSE_MS) : null,
      ]);
      if (cancelled) return;
      const to = onScreen(cardCoverOf(book.slug));
      await Promise.all([
        to
          ? play(
              bookRef.current,
              [{ transform: 'none' }, { transform: flipFrom(to, closedRect(layout)) }],
              { duration: 540, easing: 'cubic-bezier(.5,0,.25,1)' },
            )
          : play(
              bookRef.current,
              [
                { opacity: 1, transform: 'none' },
                { opacity: 0, transform: 'scale(0.94)' },
              ],
              {
                duration: 320,
              },
            ),
        play(backdropRef.current, FADE_OUT, { duration: 340, delay: 120, easing: 'ease-in' }),
      ]);
      if (!cancelled) onClosed();
    })();

    return () => {
      cancelled = true;
    };
  }, [closing, book, layout, onClosed]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !closing) onRequestClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [closing, onRequestClose]);

  useEffect(() => {
    if (!layout.narrow) return;
    const stage = stageRef.current;
    const cameraEl = cameraElRef.current;
    const camera = cameraRef.current;
    if (!stage) return;

    const goTo = (page: 1 | 2) => {
      camera.page = page;
      return glide(cameraEl, camera, page === 1 ? 0 : -layout.width, PAGE_GLIDE_MS);
    };
    let swipe: { id: number; x: number; y: number; from: number; moving: boolean } | null = null;
    let swallowClick = false;

    const onDown = (event: PointerEvent) => {
      if (!camera.ready || event.button !== 0) return;
      swipe = {
        id: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        from: camera.x,
        moving: false,
      };
    };
    const onMove = (event: PointerEvent) => {
      if (!swipe || event.pointerId !== swipe.id) return;
      const dx = event.clientX - swipe.x;
      const dy = event.clientY - swipe.y;
      if (!swipe.moving) {
        if (Math.abs(dx) < SWIPE_START_PX || Math.abs(dx) < Math.abs(dy)) return;
        swipe.moving = true;
        stage.setPointerCapture(event.pointerId);
      }
      aim(cameraEl, camera, Math.min(0, Math.max(-layout.width, swipe.from + dx)), SWIPE_ZOOM);
    };
    const onUp = (event: PointerEvent) => {
      if (!swipe || event.pointerId !== swipe.id) return;
      const { from, moving } = swipe;
      swipe = null;
      if (!moving) return;
      swallowClick = true;
      const turned = from === 0 ? camera.x < -layout.width * 0.2 : camera.x < -layout.width * 0.8;
      goTo(turned ? 2 : 1);
    };
    const onClick = (event: MouseEvent) => {
      if (swallowClick) {
        swallowClick = false;
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      if (!camera.ready || !(event.target instanceof Element)) return;
      const onHiddenPage =
        (camera.page === 1 && event.target.closest('.ak-page')) ||
        (camera.page === 2 && event.target.closest('.ak-flat'));
      if (!onHiddenPage) return;
      event.preventDefault();
      event.stopPropagation();
      goTo(camera.page === 1 ? 2 : 1);
    };
    const onFocus = (event: FocusEvent) => {
      if (!camera.ready || !(event.target instanceof Element)) return;
      if (camera.page === 1 && event.target.closest('.ak-page')) goTo(2);
      if (camera.page === 2 && event.target.closest('.ak-flat')) goTo(1);
    };
    const onKey = (event: KeyboardEvent) => {
      if (!camera.ready) return;
      if (event.key === 'ArrowRight' && camera.page === 1) goTo(2);
      if (event.key === 'ArrowLeft' && camera.page === 2) goTo(1);
    };

    stage.addEventListener('pointerdown', onDown);
    stage.addEventListener('pointermove', onMove);
    stage.addEventListener('pointerup', onUp);
    stage.addEventListener('pointercancel', onUp);
    stage.addEventListener('click', onClick, true);
    stage.addEventListener('focusin', onFocus);
    window.addEventListener('keydown', onKey);
    return () => {
      stage.removeEventListener('pointerdown', onDown);
      stage.removeEventListener('pointermove', onMove);
      stage.removeEventListener('pointerup', onUp);
      stage.removeEventListener('pointercancel', onUp);
      stage.removeEventListener('click', onClick, true);
      stage.removeEventListener('focusin', onFocus);
      window.removeEventListener('keydown', onKey);
    };
  }, [layout]);

  const requestClose = () => {
    if (!closing) onRequestClose();
  };

  const label = (
    <div className="ak-label">
      <span className="ak-kicker">Empfohlen von</span>
      <span className="ak-who">{recommenderName(book.recommended_by)}</span>
      <span className="ak-rule" />
      <span className="ak-episode">
        in der Folge „{book.topic}“,
        <br />
        {episodeDate(book.published)}
      </span>
      {book.quote && <blockquote className="ak-quote">{book.quote}</blockquote>}
      <ListenLink book={book} />
      {partners.length > 0 && (
        <div className="ak-partners">
          <OtherBooks books={partners} />
        </div>
      )}
    </div>
  );

  const facts: [string, string][] = page
    ? (
        [
          ['Verlag', imprint(page)],
          ['Umfang', page.pages ? `${page.pages} Seiten` : ''],
          ['Schauplatz', page.setting],
          ['Original', page.original_title],
          ['Übersetzung', translation(page)],
        ] as [string, string][]
      ).filter(([, value]) => value)
    : [];

  const stage: CSSProperties = {
    left: layout.left,
    top: layout.top,
    width: layout.width,
    height: layout.height,
  };

  return (
    <div
      className={`detail${layout.narrow ? ' is-narrow' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="detail-title"
    >
      <div className="detail-backdrop" ref={backdropRef} onClick={requestClose} />
      <div
        className="ak-camera"
        ref={cameraElRef}
        style={{ transform: `translateX(${-layout.pan}px)` }}
      >
        <div className="ak" style={stage} ref={stageRef}>
          <div className="ak-book" ref={bookRef}>
            <section className="ak-page">
              <div className="ak-scroll" ref={pageRef}>
                <header className="detail-head">
                  <h2 className="detail-title" id="detail-title">
                    {book.title}
                  </h2>
                  <p className="detail-author">{book.author}</p>
                </header>
                {facts.length > 0 && (
                  <dl className="detail-facts">
                    {facts.map(([term, value]) => (
                      <div key={term}>
                        <dt>{term}</dt>
                        <dd>{value}</dd>
                      </div>
                    ))}
                  </dl>
                )}
                {page?.publisher_url && (
                  <a
                    className="detail-out"
                    href={page.publisher_url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Zum Buch bei {page.publisher}
                  </a>
                )}
                {alike.length > 0 && (
                  <div className="detail-split">
                    <p className="detail-section">Vielleicht magst du auch</p>
                    {alike.map((other) => (
                      <BookLink key={other.key} book={other} withEpisode />
                    ))}
                  </div>
                )}
              </div>
            </section>
            <div className="ak-lid" ref={lidRef}>
              <div className="ak-front">
                <BookCover book={book} />
                <div className="ak-shade" ref={shadeFrontRef} />
              </div>
              <div className="ak-back" style={{ '--endpaper': endpaper } as CSSProperties} inert>
                {label}
                <div className="ak-shade" ref={shadeBackRef} />
              </div>
            </div>
          </div>
          <div className="ak-flat" ref={flatRef} hidden>
            <div
              className="ak-back ak-flat-face"
              style={{ '--endpaper': endpaper } as CSSProperties}
            >
              {label}
            </div>
          </div>
        </div>
      </div>
      <button className="detail-close" ref={closeRef} onClick={requestClose} aria-label="Schließen">
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <path
            d="M3 3l10 10M13 3L3 13"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </div>
  );
}
