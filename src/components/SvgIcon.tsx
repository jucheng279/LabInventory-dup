import React, { useContext, useEffect, useState } from 'react';
import { getIconById } from '../config/iconRegistry';
import { SyncContext } from '../contexts/SyncContext';

const COMPLEXITY_PATH_THRESHOLD = 2000;
const COMPLEXITY_SHAPE_THRESHOLD = 8;
const INTERMEDIATE_PATH_THRESHOLD = 1000;
const INTERMEDIATE_SHAPE_THRESHOLD = 5;
const COMPLEX_SIZE_MULTIPLIER = 1.15;
const COMPLEX_STROKE_MULTIPLIER = 1.3;
const FILL_ONLY_STROKE_RATIO = 0.012;
const LINE_ART_MIN_STROKE_RATIO = 0.045;
const LINE_ART_LIGHT_STROKE_REPLACEMENT = '#1f2937';

type ComplexityLevel = 'complex' | 'intermediate' | 'simple';

const svgCache = new Map<string, string>();
const processedCache = new Map<string, { html: string; renderSize: number }>();

export async function fetchSvg(svgPath: string): Promise<string | null> {
  if (svgCache.has(svgPath)) return svgCache.get(svgPath)!;
  try {
    const resp = await fetch(svgPath);
    if (!resp.ok) return null;
    const text = await resp.text();
    if (!text.includes('<svg')) return null;
    svgCache.set(svgPath, text);
    return text;
  } catch {
    return null;
  }
}

function parseViewBox(svg: string): { x: number; y: number; w: number; h: number } | null {
  const m = svg.match(/viewBox="([^"]+)"/);
  if (!m) return null;
  const parts = m[1].trim().split(/[\s,]+/).map(Number);
  if (parts.length < 4 || parts.some(isNaN)) return null;
  return { x: parts[0], y: parts[1], w: parts[2], h: parts[3] };
}

function extractDimension(svg: string, attr: string): number | null {
  const m = svg.match(new RegExp(`<svg[^>]*\\s${attr}="([^"]+)"`));
  if (!m) return null;
  const n = parseFloat(m[1]);
  return isNaN(n) ? null : n;
}

function measureComplexity(svg: string): { pathDataLength: number; shapeCount: number } {
  let pathDataLength = 0;
  const pathDataRegex = /\sd="([^"]*)"/g;
  let m;
  while ((m = pathDataRegex.exec(svg)) !== null) {
    pathDataLength += m[1].length;
  }
  const shapeCount = (svg.match(/<(path|circle|rect|ellipse|line|polygon|polyline)[\s>/]/g) || []).length;
  return { pathDataLength, shapeCount };
}

function getComplexityLevel(svg: string): ComplexityLevel {
  const { pathDataLength, shapeCount } = measureComplexity(svg);
  if (pathDataLength > COMPLEXITY_PATH_THRESHOLD || shapeCount > COMPLEXITY_SHAPE_THRESHOLD) return 'complex';
  if (pathDataLength > INTERMEDIATE_PATH_THRESHOLD || shapeCount > INTERMEDIATE_SHAPE_THRESHOLD) return 'intermediate';
  return 'simple';
}

function boostStrokeWidths(svg: string): string {
  return svg.replace(/stroke-width="([^"]+)"/g, (_, val) => {
    const n = parseFloat(val);
    if (isNaN(n)) return `stroke-width="${val}"`;
    return `stroke-width="${(n * COMPLEX_STROKE_MULTIPLIER).toFixed(2)}"`;
  });
}

function hasFillNoneAncestor(svg: string, matchIndex: number): boolean {
  const before = svg.slice(0, matchIndex);
  let depth = 0;
  const tagRe = /<(\/?)g\b([^>]*)>/g;
  const groups: string[] = [];
  let m;
  while ((m = tagRe.exec(before)) !== null) {
    if (m[1] === '/') {
      groups.pop();
    } else {
      groups.push(m[2]);
    }
  }
  for (const gAttrs of groups) {
    if (/\bfill="none"/.test(gAttrs)) return true;
  }
  return false;
}

function isLineArtSvg(svg: string): boolean {
  const shapeTagRe = /<(path|rect|circle|ellipse|line|polygon|polyline)\b([^>]*)\/?>/g;
  let total = 0;
  let strokedFillNone = 0;
  let m;
  while ((m = shapeTagRe.exec(svg)) !== null) {
    total++;
    const attrs = m[2];
    const hasStroke = /\bstroke\s*=\s*"(?!none)[^"]+"/.test(attrs);
    const fillNone = /\bfill\s*=\s*"none"/.test(attrs) || (!/\bfill\s*=/.test(attrs) && hasFillNoneAncestor(svg, m.index));
    if (hasStroke && fillNone) strokedFillNone++;
  }
  if (total === 0) return false;
  return strokedFillNone / total >= 0.6;
}

function getMaxStrokeWidth(svg: string): number {
  let max = 0;
  const re = /stroke-width="([^"]+)"/g;
  let m;
  while ((m = re.exec(svg)) !== null) {
    const n = parseFloat(m[1]);
    if (!isNaN(n) && n > max) max = n;
  }
  return max;
}

function scaleStrokeWidths(svg: string, factor: number): string {
  return svg.replace(/stroke-width="([^"]+)"/g, (_, val) => {
    const n = parseFloat(val);
    if (isNaN(n)) return `stroke-width="${val}"`;
    return `stroke-width="${(n * factor).toFixed(2)}"`;
  });
}

function isGrayscaleColor(color: string): boolean {
  const hex = color.trim().toLowerCase();
  const m = hex.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/);
  if (!m) return false;
  let r: number, g: number, b: number;
  if (m[1].length === 3) {
    r = parseInt(m[1][0] + m[1][0], 16);
    g = parseInt(m[1][1] + m[1][1], 16);
    b = parseInt(m[1][2] + m[1][2], 16);
  } else {
    r = parseInt(m[1].slice(0, 2), 16);
    g = parseInt(m[1].slice(2, 4), 16);
    b = parseInt(m[1].slice(4, 6), 16);
  }
  const maxDelta = Math.max(Math.abs(r - g), Math.abs(g - b), Math.abs(r - b));
  return maxDelta <= 20;
}

function extractColorValues(svg: string): string[] {
  const values: string[] = [];
  const re = /(?:fill|stroke)="([^"]+)"/g;
  let m;
  while ((m = re.exec(svg)) !== null) {
    const v = m[1].trim().toLowerCase();
    if (v === 'none' || v === 'currentcolor' || v === 'transparent') continue;
    values.push(v);
  }
  return values;
}

function isMonochromeSvg(svg: string): boolean {
  const values = extractColorValues(svg);
  if (values.length === 0) return true;
  for (const v of values) {
    if (!isGrayscaleColor(v)) return false;
  }
  return true;
}

function recolorMonochromeToCurrent(svg: string): string {
  let result = svg.replace(/fill="([^"]+)"/g, (match, val: string) => {
    const v = val.trim().toLowerCase();
    if (v === 'none' || v === 'currentcolor' || v === 'transparent') return match;
    return 'fill="currentColor"';
  });
  result = result.replace(/stroke="([^"]+)"/g, (match, val: string) => {
    const v = val.trim().toLowerCase();
    if (v === 'none' || v === 'currentcolor' || v === 'transparent') return match;
    return 'stroke="currentColor"';
  });
  const shapeTagRe = /<(path|rect|circle|ellipse|polygon|polyline)\b([^>]*?)(\/?)>/g;
  result = result.replace(shapeTagRe, (match, tag: string, attrs: string, selfClose: string, offset: number) => {
    if (/\bfill\s*=/.test(attrs)) return match;
    if (/\bstroke\s*=/.test(attrs)) return match;
    if (hasFillNoneAncestor(result, offset)) return match;
    return `<${tag}${attrs} fill="currentColor"${selfClose}>`;
  });
  return result;
}

function isLightGrayColor(color: string): boolean {
  const hex = color.trim().toLowerCase();
  const m = hex.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/);
  if (!m) return false;
  let r: number, g: number, b: number;
  if (m[1].length === 3) {
    r = parseInt(m[1][0] + m[1][0], 16);
    g = parseInt(m[1][1] + m[1][1], 16);
    b = parseInt(m[1][2] + m[1][2], 16);
  } else {
    r = parseInt(m[1].slice(0, 2), 16);
    g = parseInt(m[1].slice(2, 4), 16);
    b = parseInt(m[1].slice(4, 6), 16);
  }
  const maxDelta = Math.max(Math.abs(r - g), Math.abs(g - b), Math.abs(r - b));
  const luminance = (r + g + b) / 3;
  return maxDelta <= 20 && luminance > 50 && luminance < 200;
}

function darkenLightGrayStrokes(svg: string): string {
  return svg.replace(/stroke="([^"]+)"/g, (match, val: string) => {
    if (val === 'currentColor' || val === 'none') return match;
    if (isLightGrayColor(val)) return `stroke="${LINE_ART_LIGHT_STROKE_REPLACEMENT}"`;
    return match;
  });
}

function injectStrokeOnFillShapes(svg: string, viewBoxSize: number): string {
  const sw = (viewBoxSize * FILL_ONLY_STROKE_RATIO).toFixed(2);
  const shapeTagRe = /<(path|rect|circle|ellipse|polygon|polyline)\b([^>]*)\/?>/g;
  return svg.replace(shapeTagRe, (match, _tag: string, attrs: string, offset: number) => {
    if (/\bstroke\s*=/.test(attrs)) return match;
    if (/\bstroke="none"/.test(attrs)) return match;
    if (/\bfill="none"/.test(attrs)) return match;
    if (!/\bfill\s*=/.test(attrs) && hasFillNoneAncestor(svg, offset)) return match;
    return match.replace(/\/?>$/, (closing: string) => ` stroke="currentColor" stroke-width="${sw}"${closing}`);
  });
}

const UNSAFE_ELEMENTS = ['script', 'foreignObject', 'iframe', 'object', 'embed', 'style', 'set', 'handler'];

/**
 * Strip anything script-bearing from an SVG before it is injected into the DOM.
 * Icon markup can come from remote storage, so it is treated as untrusted input.
 */
function sanitizeSvg(raw: string): string {
  let svg = raw;

  for (const tag of UNSAFE_ELEMENTS) {
    svg = svg.replace(new RegExp(`<${tag}\\b[\\s\\S]*?<\\/${tag}\\s*>`, 'gi'), '');
    svg = svg.replace(new RegExp(`<${tag}\\b[^>]*\\/?>`, 'gi'), '');
  }

  // Remove every event handler attribute (onload, onclick, onmouseover, ...)
  svg = svg.replace(/\son[a-z-]+\s*=\s*"[^"]*"/gi, '');
  svg = svg.replace(/\son[a-z-]+\s*=\s*'[^']*'/gi, '');
  svg = svg.replace(/\son[a-z-]+\s*=\s*[^\s>]+/gi, '');

  // Only allow local fragment references or inline data images in href attributes
  svg = svg.replace(
    /\s(?:xlink:)?href\s*=\s*("([^"]*)"|'([^']*)')/gi,
    (match, _q, dq?: string, sq?: string) => {
      const value = (dq ?? sq ?? '').trim();
      if (value.startsWith('#')) return match;
      if (/^data:image\/(png|jpeg|gif|webp);base64,/i.test(value)) return match;
      return '';
    }
  );

  // Neutralize javascript: and other active URLs left in presentation attributes
  svg = svg.replace(/(javascript|vbscript|data\s*:\s*text\/html)\s*:/gi, 'blocked:');

  return svg;
}

function normalizeSvg(raw: string, size: number, color?: string): { html: string; renderSize: number } {
  let svg = sanitizeSvg(raw);
  const level = getComplexityLevel(raw);
  const lineArt = isLineArtSvg(raw);
  const monochrome = isMonochromeSvg(raw);

  let renderSize = size;
  if (level === 'complex') renderSize = Math.round(size * COMPLEX_SIZE_MULTIPLIER);

  const vb = parseViewBox(svg);
  const origW = extractDimension(svg, 'width');
  const origH = extractDimension(svg, 'height');
  const vbStr = vb
    ? `${vb.x} ${vb.y} ${vb.w} ${vb.h}`
    : origW && origH
      ? `0 0 ${origW} ${origH}`
      : '0 0 24 24';

  svg = svg.replace(
    /<svg([^>]*)>([\s\S]*)<\/svg>/,
    (_, attrs: string, inner: string) => {
      let updatedAttrs = attrs
        .replace(/\swidth="[^"]*"/g, '')
        .replace(/\sheight="[^"]*"/g, '');

      if (attrs.includes('viewBox')) {
        updatedAttrs = updatedAttrs.replace(/viewBox="[^"]*"/, `viewBox="${vbStr}"`);
      } else {
        updatedAttrs += ` viewBox="${vbStr}"`;
      }
      if (!/preserveAspectRatio/.test(updatedAttrs)) {
        updatedAttrs += ' preserveAspectRatio="xMidYMid meet"';
      }
      updatedAttrs += ` width="${renderSize}" height="${renderSize}"`;

      return `<svg${updatedAttrs}>${inner}</svg>`;
    }
  );

  if (monochrome) {
    svg = recolorMonochromeToCurrent(svg);
  }

  const vbSize = vb ? Math.max(vb.w, vb.h) : (origW && origH ? Math.max(origW, origH) : 24);
  svg = injectStrokeOnFillShapes(svg, vbSize);

  if (lineArt) {
    const maxStroke = getMaxStrokeWidth(svg);
    const minStroke = vbSize * LINE_ART_MIN_STROKE_RATIO;
    if (maxStroke > 0 && maxStroke < minStroke) {
      svg = scaleStrokeWidths(svg, minStroke / maxStroke);
    } else if (level !== 'simple') {
      svg = boostStrokeWidths(svg);
    }
    if (!monochrome) {
      svg = darkenLightGrayStrokes(svg);
    }
  } else if (level !== 'simple') {
    svg = boostStrokeWidths(svg);
  }

  if (color) {
    svg = svg.replace(/fill="currentColor"/g, `fill="${color}"`);
    svg = svg.replace(/stroke="currentColor"/g, `stroke="${color}"`);
  }

  return { html: svg, renderSize };
}

interface SvgIconProps {
  iconId: string | null | undefined;
  size?: number;
  color?: string;
  className?: string;
  forceColorful?: boolean;
}

const SvgIcon: React.FC<SvgIconProps> = ({ iconId, size = 24, color, className, forceColorful = false }) => {
  const syncCtx = useContext(SyncContext);
  const colorfulIconsEnabled = syncCtx?.colorfulIconsEnabled ?? true;
  const effectiveColor = !forceColorful && !colorfulIconsEnabled ? '#000000' : color;
  const [svgContent, setSvgContent] = useState<string | null>(null);
  const [loadedIconId, setLoadedIconId] = useState<string | null>(null);

  const entry = iconId ? getIconById(iconId) : undefined;

  useEffect(() => {
    if (!entry) {
      setSvgContent(null);
      setLoadedIconId(null);
      return;
    }
    setSvgContent(null);
    setLoadedIconId(null);
    let cancelled = false;
    fetchSvg(entry.svgPath).then((content) => {
      if (!cancelled) {
        setSvgContent(content);
        setLoadedIconId(entry.id);
      }
    });
    return () => { cancelled = true; };
  }, [entry]);

  if (!entry || svgContent === null || loadedIconId !== iconId) {
    return null;
  }

  const cacheKey = `${iconId}__${size}__${effectiveColor ?? ''}`;
  let processed = processedCache.get(cacheKey);
  if (!processed) {
    processed = normalizeSvg(svgContent, size, effectiveColor);
    processedCache.set(cacheKey, processed);
  }

  return (
    <span
      className={className}
      style={{ display: 'inline-flex', width: processed.renderSize, height: processed.renderSize }}
      dangerouslySetInnerHTML={{ __html: processed.html }}
    />
  );
};

export default SvgIcon;
