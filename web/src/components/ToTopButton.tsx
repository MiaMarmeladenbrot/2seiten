import { useEffect, useState } from 'react';

const SHOW_AFTER_VIEWPORTS = 1.5;

function scrolledFarEnough(): boolean {
  return window.scrollY > window.innerHeight * SHOW_AFTER_VIEWPORTS;
}

function scrollToTop() {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  window.scrollTo({ top: 0, behavior: reduceMotion ? 'instant' : 'smooth' });
}

export function ToTopButton() {
  const [visible, setVisible] = useState(scrolledFarEnough);

  useEffect(() => {
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setVisible(scrolledFarEnough()));
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  return (
    <button
      type="button"
      className={visible ? 'to-top is-visible' : 'to-top'}
      onClick={scrollToTop}
      aria-label="Nach oben"
      tabIndex={visible ? 0 : -1}
      aria-hidden={!visible}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 19V5M5.5 11.5 12 5l6.5 6.5" />
      </svg>
    </button>
  );
}
