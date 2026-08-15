function findTarget(tutorialId: string): HTMLElement | null {
  return document.querySelector(`[data-tutorial-id="${tutorialId}"]`);
}

export function waitForTarget(tutorialId: string, timeoutMs = 3000): Promise<HTMLElement> {
  return new Promise((resolve, reject) => {
    const existing = findTarget(tutorialId);
    if (existing) { resolve(existing); return; }

    const timer = setTimeout(() => {
      observer.disconnect();
      reject(new Error(`Tutorial target "${tutorialId}" not found within ${timeoutMs}ms`));
    }, timeoutMs);

    const observer = new MutationObserver(() => {
      const el = findTarget(tutorialId);
      if (el) {
        clearTimeout(timer);
        observer.disconnect();
        resolve(el);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  });
}

function nextFrame(): Promise<void> {
  return new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r())));
}

export async function clickTarget(tutorialId: string): Promise<void> {
  const el = await waitForTarget(tutorialId);
  el.click();
  await nextFrame();
}

export async function fillTarget(tutorialId: string, value: string): Promise<void> {
  const el = await waitForTarget(tutorialId) as HTMLInputElement | HTMLTextAreaElement;
  const setter =
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
    || Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
  if (setter) {
    setter.call(el, value);
  } else {
    el.value = value;
  }
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  await nextFrame();
}

export function delay(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}
