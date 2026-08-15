export function scaled(base: number, factor: number): number {
  return Math.round(base * factor * 100) / 100;
}

const ROW_FIXED_LEFT = 10 + 48 + 12;
const ROW_FIXED_RIGHT = 30 + 10;
const HEADER_COL_GAP = 12;
const MIN_HEADER_COL_WIDTH = 60;
export function computeIdealRowWidth(headerCount: number): number {
  const count = Math.max(headerCount, 1);
  const headerSpace = count * MIN_HEADER_COL_WIDTH + (count - 1) * HEADER_COL_GAP;
  return ROW_FIXED_LEFT + headerSpace + ROW_FIXED_RIGHT;
}

export function computeScaleFactor(containerWidth: number, idealWidth: number): number {
  if (containerWidth >= idealWidth) return 1;
  return containerWidth / idealWidth;
}
