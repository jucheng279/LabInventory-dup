const ROW_HEIGHT = 72;
const VERTICAL_PADDING = 24;
const USABLE_HEIGHT = ROW_HEIGHT - VERTICAL_PADDING;

export interface SlideTextLayout {
  fontSize: number;
  lineHeight: number;
  maxLines: number;
}

export function computeSlideTextLayout(fontDivisor: number): SlideTextLayout {
  const divisor = Math.max(3, Math.min(20, fontDivisor));
  const fontSize = Math.round(140 / divisor);
  const lineHeight = Math.round(fontSize * 1.15);
  const maxLines = Math.max(1, Math.min(3, Math.floor(USABLE_HEIGHT / lineHeight)));

  return { fontSize, lineHeight, maxLines };
}
