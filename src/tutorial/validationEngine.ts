import type { TutorialActionType } from './types';

type ValidationCleanup = () => void;

export function attachStepValidator(
  targetId: string,
  action: TutorialActionType,
  expectedValue: string | undefined,
  onValidated: () => void
): ValidationCleanup {
  const findTarget = () => document.querySelector(`[data-tutorial-id="${targetId}"]`) as HTMLElement | null;

  let cleanup: ValidationCleanup = () => {};

  const attemptAttach = () => {
    const target = findTarget();
    if (!target) {
      const observer = new MutationObserver(() => {
        const el = findTarget();
        if (el) {
          observer.disconnect();
          attach(el);
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
      cleanup = () => observer.disconnect();
      return;
    }
    attach(target);
  };

  const attach = (target: HTMLElement) => {
    switch (action) {
      case 'click':
      case 'submit':
      case 'navigate':
      case 'select': {
        const handler = () => {
          onValidated();
        };
        target.addEventListener('click', handler, { once: true });
        cleanup = () => target.removeEventListener('click', handler);
        break;
      }
      case 'type': {
        let fired = false;
        let deferTimer: ReturnType<typeof setTimeout> | null = null;
        const handler = () => {
          if (fired) return;
          if (!expectedValue) {
            fired = true;
            target.removeEventListener('input', handler);
            target.removeEventListener('change', handler);
            deferTimer = setTimeout(onValidated, 0);
            return;
          }
          const input = target as HTMLInputElement | HTMLTextAreaElement;
          const val = input.value?.trim().toLowerCase() ?? '';
          const expected = expectedValue.trim().toLowerCase();
          if (val === expected || val.includes(expected)) {
            fired = true;
            target.removeEventListener('input', handler);
            target.removeEventListener('change', handler);
            deferTimer = setTimeout(onValidated, 0);
          }
        };
        target.addEventListener('input', handler);
        target.addEventListener('change', handler);
        cleanup = () => {
          target.removeEventListener('input', handler);
          target.removeEventListener('change', handler);
          if (deferTimer !== null) clearTimeout(deferTimer);
        };
        break;
      }
    }
  };

  attemptAttach();
  return cleanup;
}

export function getTargetElement(targetId: string): HTMLElement | null {
  return document.querySelector(`[data-tutorial-id="${targetId}"]`) as HTMLElement | null;
}

export function getTargetRect(targetId: string): DOMRect | null {
  const el = getTargetElement(targetId);
  return el ? el.getBoundingClientRect() : null;
}
