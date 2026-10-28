import { useEffect, useState } from 'react';

/** Tracks which of the given section ids is in the reading band of the viewport. */
export function useActiveSection(ids: string[], fallback: string) {
  const [active, setActive] = useState(fallback);
  const key = ids.join('|');

  useEffect(() => {
    const nodes = ids.map((id) => document.getElementById(id)).filter((n): n is HTMLElement => Boolean(n));
    if (!nodes.length || typeof IntersectionObserver === 'undefined') return;
    const visible = new Map<string, number>();
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((e) => (e.isIntersecting ? visible.set(e.target.id, e.boundingClientRect.top) : visible.delete(e.target.id)));
      if (!visible.size) return;
      const next = ids.find((id) => visible.has(id));
      if (next) setActive(next);
    }, { rootMargin: '-30% 0px -55% 0px' });
    nodes.forEach((n) => observer.observe(n));
    return () => observer.disconnect();
  }, [key]);

  return active;
}

/** True once the page has scrolled past `offset` pixels. */
export function useScrolled(offset = 24) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > offset);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [offset]);
  return scrolled;
}
