const FONT_FAMILY = '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

let canvas: HTMLCanvasElement | null = null;

function getCanvas(): HTMLCanvasElement {
  if (!canvas) {
    canvas = document.createElement('canvas');
  }
  return canvas;
}

export function computeFittedFontSize(
  text: string,
  maxFontSize: number,
  availableWidth: number,
  fontWeight: number | string = 400
): number {
  if (!text || availableWidth <= 0) return maxFontSize;

  const ctx = getCanvas().getContext('2d');
  if (!ctx) return maxFontSize;

  ctx.font = `${fontWeight} ${maxFontSize}px ${FONT_FAMILY}`;
  const measured = ctx.measureText(text).width;

  if (measured <= availableWidth) return maxFontSize;

  return maxFontSize * (availableWidth / measured);
}

function countLines(
  text: string,
  fontSize: number,
  fontWeight: number | string,
  availableWidth: number
): number {
  const ctx = getCanvas().getContext('2d');
  if (!ctx) return 1;

  ctx.font = `${fontWeight} ${fontSize}px ${FONT_FAMILY}`;

  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return 0;

  let lines = 1;
  let lineWidth = 0;
  const spaceWidth = ctx.measureText(' ').width;

  for (const word of words) {
    const wordWidth = ctx.measureText(word).width;
    if (lineWidth === 0) {
      lineWidth = wordWidth;
    } else if (lineWidth + spaceWidth + wordWidth <= availableWidth) {
      lineWidth += spaceWidth + wordWidth;
    } else {
      lines++;
      lineWidth = wordWidth;
    }
  }

  return lines;
}

export function computeFittedFontSizeMultiline(
  text: string,
  maxFontSize: number,
  availableWidth: number,
  availableHeight: number,
  fontWeight: number | string = 400,
  lineHeight: number = 1.4
): number {
  if (!text || availableWidth <= 0 || availableHeight <= 0) return maxFontSize;

  let fontSize = maxFontSize;
  const lines = countLines(text, fontSize, fontWeight, availableWidth);
  const totalHeight = lines * fontSize * lineHeight;

  if (totalHeight <= availableHeight) return maxFontSize;

  fontSize = maxFontSize * (availableHeight / totalHeight);

  const linesAtSmaller = countLines(text, fontSize, fontWeight, availableWidth);
  const heightAtSmaller = linesAtSmaller * fontSize * lineHeight;

  if (heightAtSmaller > availableHeight) {
    fontSize = fontSize * (availableHeight / heightAtSmaller);
  }

  return fontSize;
}
