import * as pdfjs from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

export async function getPdfPageCount(file: Blob) {
  const data = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data }).promise;
  const count = pdf.numPages;
  await pdf.destroy();
  return count;
}

export async function renderPdfPage(file: Blob, pageNumber: number, scale = 1.5) {
  const data = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data }).promise;
  const page = await pdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvasを初期化できませんでした");
  await page.render({ canvasContext: context, viewport }).promise;
  await pdf.destroy();
  return canvas;
}

export async function makePdfThumbnail(file: Blob) {
  const canvas = await renderPdfPage(file, 1, 0.7);
  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("PDFサムネイルを生成できませんでした"));
    }, "image/jpeg", 0.78);
  });
}
