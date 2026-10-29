/**
 * Extrai o texto de um PDF de cupom (DANFE NFC-e) em linhas, agrupando os pedacos de texto pela altura na pagina.
 * `pdfjs` e injetado para o mesmo codigo rodar no navegador (com worker) e nos testes (Node).
 */
interface TextItem {
  str: string;
  transform: number[];
}

interface PdfjsLike {
  getDocument(src: { data: Uint8Array; isEvalSupported?: boolean }): { promise: Promise<{ numPages: number; getPage(n: number): Promise<{ getTextContent(): Promise<{ items: unknown[] }> }> }> };
}

export async function extractPdfLines(data: ArrayBuffer, pdfjs: PdfjsLike): Promise<string> {
  const doc = await pdfjs.getDocument({ data: new Uint8Array(data), isEvalSupported: false }).promise;
  const out: string[] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const content = await page.getTextContent();
    const rows = new Map<number, { x: number; s: string }[]>();
    for (const it of content.items as TextItem[]) {
      if (!it.str || !it.str.trim()) continue;
      const y = Math.round(it.transform[5] / 2) * 2; // tolerancia de 2 pontos para a mesma linha
      const row = rows.get(y) ?? [];
      row.push({ x: it.transform[4], s: it.str });
      rows.set(y, row);
    }
    // PDF mede a altura de baixo para cima: linhas de cima tem y maior
    for (const y of [...rows.keys()].sort((a, b) => b - a)) {
      out.push(rows.get(y)!.sort((a, b) => a.x - b.x).map((p) => p.s.trim()).join(" "));
    }
  }
  return out.join("\n");
}

/** No navegador: carrega o pdf.js so quando alguem escolhe um PDF (nao pesa no resto do app). */
export async function pdfFileToText(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const worker = await import("pdfjs-dist/legacy/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  return extractPdfLines(await file.arrayBuffer(), pdfjs as unknown as PdfjsLike);
}
