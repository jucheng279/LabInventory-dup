import { getAllIcons } from '../config/iconRegistry';
import { fetchSvg } from '../components/SvgIcon';

let hasPreloaded = false;
let preloadPromise: Promise<void> | null = null;

function scheduleIdle(fn: () => void): void {
  const w = window as unknown as {
    requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
  };
  if (typeof w.requestIdleCallback === 'function') {
    w.requestIdleCallback(fn, { timeout: 2000 });
  } else {
    setTimeout(fn, 0);
  }
}

export function preloadAllIcons(): Promise<void> {
  if (hasPreloaded) return Promise.resolve();
  if (preloadPromise) return preloadPromise;

  preloadPromise = new Promise<void>((resolve) => {
    scheduleIdle(async () => {
      try {
        const icons = getAllIcons();
        const BATCH_SIZE = 20;
        for (let i = 0; i < icons.length; i += BATCH_SIZE) {
          const batch = icons.slice(i, i + BATCH_SIZE);
          await Promise.all(
            batch.map((icon) =>
              fetchSvg(icon.svgPath).catch(() => null),
            ),
          );
        }
        hasPreloaded = true;
      } finally {
        resolve();
      }
    });
  });

  return preloadPromise;
}
