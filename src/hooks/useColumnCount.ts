import { useState, useEffect, type RefObject } from 'react';

export function useColumnCount(ref: RefObject<HTMLDivElement | null>) {
  const [cols, setCols] = useState(1);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0;
      if (w >= 1600) setCols(4);
      else if (w >= 1120) setCols(3);
      else if (w >= 672) setCols(2);
      else setCols(1);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return cols;
}
