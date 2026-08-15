import { toPng } from 'html-to-image';

export async function exportLabelAsPng(element: HTMLElement, fileName: string): Promise<void> {
  const dataUrl = await toPng(element, {
    width: 680,
    height: 383,
    pixelRatio: 2,
    backgroundColor: '#ffffff',
  });

  const blob = await (await fetch(dataUrl)).blob();
  const file = new File([blob], fileName, { type: 'image/png' });

  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return;
    } catch { /* user cancelled */ }
  }

  const blobUrl = URL.createObjectURL(blob);
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  if (isMobile) {
    window.open(blobUrl, '_blank');
    setTimeout(() => URL.revokeObjectURL(blobUrl), 30000);
  } else {
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 100);
  }
}

export async function printLabel(element: HTMLElement): Promise<void> {
  const dataUrl = await toPng(element, {
    width: 680,
    height: 383,
    pixelRatio: 2,
    backgroundColor: '#ffffff',
  });

  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
<title>Print Label</title>
<style>
  @page { margin: 1cm; size: landscape; }
  * { margin: 0; padding: 0; }
  html, body { width: 100%; height: 100%; overflow: hidden; }
  body { text-align: center; }
  img { display: block; margin: 0 auto; max-width: 100%; max-height: 100%; }
</style>
</head>
<body>
<img src="${dataUrl}" onload="setTimeout(function(){window.print();},100)" />
</body>
</html>`);
  printWindow.document.close();
}
