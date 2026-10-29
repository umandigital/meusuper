/**
 * Funcao serverless (Vercel): busca a pagina publica de uma NFC-e na SEFAZ e devolve os itens em JSON.
 * O navegador nao pode fazer isso sozinho (CORS). Seguranca: exige login valido no Supabase e so acessa
 * dominios da SEFAZ (inclusive nos redirecionamentos), para nao virar um proxy aberto.
 *
 * ATENCAO: o leitor (parseNfce) segue o layout padrao das consultas publicas de NFC-e (classes txtTit,
 * Rqtd, RUN, RvlUnit). Ainda precisa ser validado com uma nota real do RS.
 */
declare const process: { env: Record<string, string | undefined> };

export interface Receipt {
  store: string | null;
  date: string | null;
  items: { name: string; quantity: number; unit: string; unit_price: number }[];
  total: number | null;
}

const ALLOWED_HOST = /(^|\.)(sefaz\.rs\.gov\.br|svrs\.rs\.gov\.br|fazenda\.gov\.br)$/;
const MAX_BYTES = 2_000_000;

const decode = (s: string) =>
  s
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\s+/g, " ")
    .trim();

/** "1.234,56" -> 1234.56; texto vazio ou invalido vira NaN (nunca 0). */
const num = (s: string) => (s.trim() === "" ? NaN : Number(s.replace(/\./g, "").replace(",", ".")));

const stripTags = (h: string) => decode(h.replace(/<br\s*\/?>/gi, " "));

/** Estrategia A: layout legado de consulta publica (classes txtTit, Rqtd, RUN, RvlUnit). */
function parseLegacy(html: string): Receipt["items"] {
  const items: Receipt["items"] = [];
  // cada item comeca em um txtTit; cada trecho e lido separadamente para um campo faltando nao desalinhar os demais
  const chunks = html.split(/(?=<span[^>]*class="txtTit)/).slice(1);
  for (const c of chunks) {
    const name = decode(c.match(/class="txtTit[^"]*"[^>]*>([\s\S]*?)<\/span>/)?.[1] ?? "");
    const qty = c.match(/class="Rqtd"[^>]*>[\s\S]*?<\/strong>\s*([\d.,]+)/)?.[1];
    const unit = c.match(/class="RUN"[^>]*>[\s\S]*?<\/strong>\s*([A-Za-z]+)/)?.[1] ?? "UN";
    const unitPrice = c.match(/class="RvlUnit"[^>]*>[\s\S]*?<\/strong>\s*([\d.,]+)/)?.[1];
    const lineTotal = c.match(/class="valor"[^>]*>\s*([\d.,]+)/)?.[1];
    if (!name || !qty) continue;
    const quantity = num(qty);
    const price = unitPrice ? num(unitPrice) : lineTotal && quantity > 0 ? num(lineTotal) / quantity : NaN;
    if (!(quantity > 0) || !(price >= 0)) continue;
    items.push({ name, quantity, unit: unit.toUpperCase(), unit_price: price });
  }
  return items;
}

/**
 * Estrategia B: qualquer tabela cujo cabecalho tenha Descricao + Quantidade + valor (unitario e/ou total).
 * As colunas sao achadas pelo texto do cabecalho, entao a ordem delas nao importa.
 */
function parseTables(html: string): Receipt["items"] {
  const items: Receipt["items"] = [];
  for (const table of html.match(/<table[\s\S]*?<\/table>/gi) ?? []) {
    const rows = (table.match(/<tr[\s\S]*?<\/tr>/gi) ?? []).map((r) => (r.match(/<t[hd][\s\S]*?<\/t[hd]>/gi) ?? []).map(stripTags));
    const headIdx = rows.findIndex((cells) => cells.some((c) => /descri/i.test(c)) && cells.some((c) => /qtd|quant/i.test(c)) && cells.some((c) => /unit|total|valor/i.test(c)));
    if (headIdx < 0) continue;
    const head = rows[headIdx];
    const col = (re: RegExp) => head.findIndex((c) => re.test(c));
    const iName = col(/descri/i);
    const iQty = col(/qtd|quant/i);
    const iUn = head.findIndex((c) => /^(un|unid)\.?(ade)?:?$/i.test(c.trim()));
    const iUnit = col(/unit/i);
    const iTotal = col(/total/i);
    for (const cells of rows.slice(headIdx + 1)) {
      if (cells.length < head.length - 1) continue;
      const name = cells[iName];
      const quantity = num(cells[iQty] ?? "");
      const unitPrice = iUnit >= 0 ? num(cells[iUnit] ?? "") : NaN;
      const total = iTotal >= 0 ? num(cells[iTotal] ?? "") : NaN;
      const price = Number.isFinite(unitPrice) ? unitPrice : quantity > 0 ? total / quantity : NaN;
      if (!name || !(quantity > 0) || !(price >= 0) || !Number.isFinite(price)) continue;
      items.push({ name, quantity, unit: (iUn >= 0 ? cells[iUn] : "UN").toUpperCase().slice(0, 4) || "UN", unit_price: price });
    }
    if (items.length) break;
  }
  return items;
}

export function parseNfce(html: string): Receipt {
  const items = parseLegacy(html);
  if (!items.length) items.push(...parseTables(html));
  const store = decode(html.match(/class="txtTopo"[^>]*>([\s\S]*?)<\/div>/)?.[1] ?? "") || null;
  const d = html.match(/Emiss[ãa]o[\s\S]{0,120}?(\d{2})\/(\d{2})\/(\d{4})/i) ?? html.match(/(\d{2})\/(\d{2})\/(\d{4})\s+\d{2}:\d{2}:\d{2}/);
  const date = d ? `${d[3]}-${d[2]}-${d[1]}` : null;
  const totalRaw = html.match(/Valor\s+total\s+R\$[\s\S]*?class="totalNumb[^"]*"[^>]*>\s*([\d.,]+)/i)?.[1];
  return { store, date, items, total: totalRaw ? num(totalRaw) : null };
}

/** Texto visivel da pagina (sem scripts), com CPF mascarado, para calibrar o leitor quando o layout for desconhecido. */
export function diagnosticText(html: string): string {
  const body = html
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<!--[\s\S]*?-->/gi, "")
    .replace(/<\/(tr|p|div|li|h\d|table)>/gi, "\n")
    .replace(/<\/t[dh]>/gi, " | ")
    .replace(/<[^>]+>/g, " ");
  return decode(body.replace(/\n+/g, "\n"))
    .replace(/\d{3}\.?\d{3}\.?\d{3}-?\d{2}(?!\d)/g, "***.***.***-**")
    .slice(0, 15000);
}

export function isAllowedUrl(raw: string): URL | null {
  try {
    const u = new URL(raw);
    return u.protocol === "https:" && ALLOWED_HOST.test(u.hostname) ? u : null;
  } catch {
    return null;
  }
}

async function fetchPage(start: URL): Promise<string> {
  let url = start;
  for (let hop = 0; hop < 4; hop++) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 10_000);
    try {
      const r = await fetch(url, { redirect: "manual", signal: ctl.signal, headers: { "user-agent": "Mozilla/5.0 (MeuSuper)" } });
      if (r.status >= 300 && r.status < 400 && r.headers.get("location")) {
        const next = isAllowedUrl(new URL(r.headers.get("location")!, url).toString());
        if (!next) throw new Error("redirect-blocked");
        url = next;
        continue;
      }
      if (!r.ok) throw new Error(`http-${r.status}`);
      const buf = await r.arrayBuffer();
      if (buf.byteLength > MAX_BYTES) throw new Error("too-big");
      const charset = /charset=([\w-]+)/i.exec(r.headers.get("content-type") ?? "")?.[1] ?? "utf-8";
      return new TextDecoder(charset).decode(buf);
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error("too-many-redirects");
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any) {
  if (req.method !== "POST") return res.status(405).json({ error: "method" });

  const token = String(req.headers?.authorization ?? "").replace(/^Bearer\s+/i, "");
  const base = process.env.VITE_SUPABASE_URL;
  const anon = process.env.VITE_SUPABASE_ANON_KEY;
  if (!token || !base || !anon) return res.status(401).json({ error: "auth" });
  const who = await fetch(`${base}/auth/v1/user`, { headers: { apikey: anon, authorization: `Bearer ${token}` } }).catch(() => null);
  if (!who || !who.ok) return res.status(401).json({ error: "auth" });

  const target = isAllowedUrl(String(req.body?.url ?? ""));
  if (!target) return res.status(400).json({ error: "url" });

  let html: string;
  try {
    html = await fetchPage(target);
  } catch (e) {
    return res.status(502).json({ error: "fetch", detail: (e as Error).message });
  }
  const receipt = parseNfce(html);
  if (!receipt.items.length) return res.status(422).json({ error: "layout", debug: diagnosticText(html) });
  return res.status(200).json(receipt);
}
