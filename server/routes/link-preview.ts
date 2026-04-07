import { RequestHandler } from "express";

// Sites that serve generic brand meta tags instead of product data
const GENERIC_OG_SITES: RegExp[] = [
  /amazon\./i,
  /amzn\./i,
];

function isGenericOgSite(url: string): boolean {
  return GENERIC_OG_SITES.some((re) => re.test(url));
}

// Regex helpers to extract meta tags from raw HTML
function extractMeta(html: string, property: string): string | null {
  // Matches both og:xxx and name="xxx" variants, single or double quotes
  const patterns = [
    new RegExp(
      `<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']+)["']`,
      "i",
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${property}["']`,
      "i",
    ),
    new RegExp(
      `<meta[^>]+name=["']${property}["'][^>]+content=["']([^"']+)["']`,
      "i",
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${property}["']`,
      "i",
    ),
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m?.[1]) return m[1].trim();
  }
  return null;
}

// Amazon-specific extractors that bypass generic OG tags
function extractAmazonTitle(html: string): string | null {
  // #productTitle span
  const m =
    html.match(/id=["']productTitle["'][^>]*>\s*([^<]{5,}?)\s*<\/span>/i) ??
    html.match(/<span[^>]+id=["']productTitle["'][^>]*>\s*([\s\S]{5,200}?)\s*<\/span>/i);
  return m?.[1]?.replace(/\s+/g, " ").trim() ?? null;
}

function extractAmazonImage(html: string): string | null {
  // landingImage or main product image data attributes
  const patterns = [
    /id=["']landingImage["'][^>]+src=["']([^"']+)["']/i,
    /id=["']imgBlkFront["'][^>]+src=["']([^"']+)["']/i,
    /"hiRes"\s*:\s*"(https:\/\/[^"]+\.jpg[^"]*)"/i,
    /"large"\s*:\s*"(https:\/\/[^"]+\.jpg[^"]*)"/i,
    /data-old-hires=["'](https:\/\/[^"']+)["']/i,
    /data-a-dynamic-image=["'](\{[^"']+\})["']/i,
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m?.[1]) {
      // data-a-dynamic-image is a JSON object of {url: width} — pick the first key
      if (m[1].startsWith("{")) {
        try {
          const obj = JSON.parse(m[1].replace(/&quot;/g, '"'));
          const first = Object.keys(obj)[0];
          if (first) return first;
        } catch { /* skip */ }
      }
      return m[1];
    }
  }
  return null;
}

function extractAmazonPrice(html: string): number | null {
  // .a-price-whole + .a-price-fraction or data-asin-price
  const patterns = [
    /class=["'][^"']*a-price-whole[^"']*["'][^>]*>\s*([\d.,]+)/i,
    /data-asin-price=["']([\d.,]+)["']/i,
    /"priceAmount"\s*:\s*([\d.]+)/i,
    /priceToPay[^>]+>\s*<span[^>]*>\s*R?\$?\s*([\d.,]+)/i,
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m?.[1]) {
      const p = cleanPrice(m[1]);
      if (p) return p;
    }
  }
  return null;
}

function extractTitle(html: string): string | null {
  const m = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return m?.[1]?.trim() ?? null;
}

function cleanPrice(raw: string | null): number | null {
  if (!raw) return null;
  // Remove currency symbols, thousand separators — keep digits, dot, comma
  const cleaned = raw.replace(/[^\d.,]/g, "").replace(",", ".");
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

function resolveUrl(src: string | null, base: string): string | null {
  if (!src) return null;
  try {
    return new URL(src, base).href;
  } catch {
    return null;
  }
}

export const handleLinkPreview: RequestHandler = async (req, res) => {
  const { url } = req.query as { url?: string };

  if (!url) {
    return res.status(400).json({ error: "url é obrigatório" });
  }

  let targetUrl: string;
  try {
    targetUrl = new URL(url).href;
  } catch {
    return res.status(400).json({ error: "URL inválida" });
  }

  // Block private/internal addresses
  const hostname = new URL(targetUrl).hostname;
  if (
    hostname === "localhost" ||
    hostname.startsWith("127.") ||
    hostname.startsWith("192.168.") ||
    hostname.startsWith("10.") ||
    hostname === "0.0.0.0"
  ) {
    return res.status(400).json({ error: "URL não permitida" });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(targetUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; RitmoFitBot/1.0; +https://ritmofit.app)",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
      },
      redirect: "follow",
    });

    clearTimeout(timeout);

    if (!response.ok) {
      return res
        .status(502)
        .json({ error: `Site retornou ${response.status}` });
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html")) {
      return res.status(422).json({ error: "URL não aponta para uma página HTML" });
    }

    // Read only first 100 KB to keep it fast
    const reader = response.body?.getReader();
    let html = "";
    if (reader) {
      const decoder = new TextDecoder();
      let bytesRead = 0;
      while (bytesRead < 100_000) {
        const { done, value } = await reader.read();
        if (done) break;
        html += decoder.decode(value, { stream: true });
        bytesRead += value.byteLength;
      }
      reader.cancel();
    } else {
      html = await response.text();
    }

    // Extract data — Amazon blocks og: tags, use site-specific scrapers first
    const isAmazon = isGenericOgSite(targetUrl);

    const title = isAmazon
      ? (extractAmazonTitle(html) ?? extractMeta(html, "og:title") ?? extractTitle(html))
      : (extractMeta(html, "og:title") ?? extractMeta(html, "twitter:title") ?? extractTitle(html));

    const description =
      extractMeta(html, "og:description") ??
      extractMeta(html, "twitter:description") ??
      extractMeta(html, "description");

    const rawImage = isAmazon
      ? extractAmazonImage(html)
      : (extractMeta(html, "og:image") ?? extractMeta(html, "twitter:image") ?? extractMeta(html, "twitter:image:src"));

    const image = resolveUrl(rawImage, targetUrl);

    // ── Price extraction: multiple strategies ────────────────────────────────

    let price: number | null = null;

    // 0) Amazon-specific
    if (isAmazon) price = extractAmazonPrice(html);

    // 1) OG / meta tags
    const rawPriceMeta =
      extractMeta(html, "og:price:amount") ??
      extractMeta(html, "product:price:amount") ??
      extractMeta(html, "twitter:data1");
    if (rawPriceMeta) price = cleanPrice(rawPriceMeta);

    // 2) JSON-LD (schema.org Product / Offer)
    if (!price) {
      const jsonLdMatches = html.matchAll(
        /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
      );
      for (const match of jsonLdMatches) {
        try {
          const obj = JSON.parse(match[1]);
          const candidates = Array.isArray(obj) ? obj : [obj];
          for (const node of candidates) {
            // Direct price
            const p = node?.price ?? node?.offers?.price ?? node?.offers?.[0]?.price;
            if (p != null) {
              price = cleanPrice(String(p));
              if (price) break;
            }
          }
        } catch {
          // malformed JSON-LD — skip
        }
        if (price) break;
      }
    }

    // 3) itemprop="price"
    if (!price) {
      const itemPropMatch = html.match(
        /itemprop=["']price["'][^>]*content=["']([^"']+)["']/i,
      ) ?? html.match(
        /content=["']([^"']+)["'][^>]*itemprop=["']price["']/i,
      );
      if (itemPropMatch) price = cleanPrice(itemPropMatch[1]);
    }

    // 4) data-price attribute (common in BR e-commerce)
    if (!price) {
      const dataPriceMatch = html.match(/data-price=["']([^"']+)["']/i);
      if (dataPriceMatch) price = cleanPrice(dataPriceMatch[1]);
    }

    return res.json({
      url: targetUrl,
      title: title ?? null,
      description: description ?? null,
      image: image ?? null,
      price: price ?? null,
    });
  } catch (err: any) {
    if (err?.name === "AbortError") {
      return res.status(504).json({ error: "Timeout ao buscar a URL" });
    }
    console.error("[link-preview] Error:", err?.message ?? err);
    return res.status(502).json({ error: "Não foi possível acessar a URL" });
  }
};
