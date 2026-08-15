import UTIF from 'utif';

export function isTiffPath(path: string): boolean {
  const lower = path.toLowerCase();
  return lower.endsWith('.tif') || lower.endsWith('.tiff');
}

export async function decodeTiffToDataUrl(url: string): Promise<string> {
  const response = await fetch(url);
  const buffer = await response.arrayBuffer();
  const ifds = UTIF.decode(buffer);
  UTIF.decodeImage(buffer, ifds[0]);
  const ifd = ifds[0];
  const rgba = UTIF.toRGBA8(ifd);

  const canvas = document.createElement('canvas');
  canvas.width = ifd.width;
  canvas.height = ifd.height;
  const ctx = canvas.getContext('2d')!;
  const imageData = ctx.createImageData(ifd.width, ifd.height);
  imageData.data.set(new Uint8Array(rgba));
  ctx.putImageData(imageData, 0, 0);

  return canvas.toDataURL('image/png');
}
