function decodeHtml(value = "") {
  return String(value)
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x2F;/gi, "/")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)));
}

function cleanText(value = "") {
  return decodeHtml(String(value).replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeDuckUrl(raw = "") {
  const value = decodeHtml(raw);
  try {
    const parsed = new URL(value, "https://duckduckgo.com");
    const redirected = parsed.searchParams.get("uddg");
    if (redirected) return decodeURIComponent(redirected);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") return parsed.href;
  } catch {
    // ignore invalid urls
  }
  return value;
}

function parseDuckDuckGo(html) {
  const results = [];
  const anchor = /<a[^>]*class=["'][^"']*result__a[^"']*["'][^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  const matches = [...html.matchAll(anchor)];

  for (let index = 0; index < matches.length && results.length < 6; index += 1) {
    const match = matches[index];
    const start = match.index + match[0].length;
    const end = matches[index + 1]?.index ?? Math.min(html.length, start + 7000);
    const nearby = html.slice(start, end);
    const snippetMatch = nearby.match(/class=["'][^"']*result__snippet[^"']*["'][^>]*>([\s\S]*?)<\/(?:a|div|span)>/i);
    const title = cleanText(match[2]);
    const url = normalizeDuckUrl(match[1]);
    const snippet = cleanText(snippetMatch?.[1] ?? "");
    if (!title || !/^https?:\/\//i.test(url)) continue;
    results.push({ title, url, snippet, source: "DuckDuckGo" });
  }

  return results;
}

function parseGoogleNews(xml) {
  const results = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  for (const item of xml.matchAll(itemRegex)) {
    if (results.length >= 4) break;
    const block = item[1];
    const title = cleanText(block.match(/<title>([\s\S]*?)<\/title>/i)?.[1] ?? "");
    const url = cleanText(block.match(/<link>([\s\S]*?)<\/link>/i)?.[1] ?? "");
    const publishedAt = cleanText(block.match(/<pubDate>([\s\S]*?)<\/pubDate>/i)?.[1] ?? "");
    if (!title || !/^https?:\/\//i.test(url)) continue;
    results.push({ title, url, snippet: publishedAt ? `게시 시각: ${publishedAt}` : "", source: "Google News" });
  }
  return results;
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      "user-agent": "Mozilla/5.0 (compatible; LocalAIAcademy/1.0; +https://vercel.app)",
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "accept-language": "ko-KR,ko;q=0.9,en;q=0.7",
    },
    signal: AbortSignal.timeout(9000),
  });
  if (!response.ok) throw new Error(`search upstream ${response.status}`);
  return response.text();
}

async function searchDuckDuckGo(query) {
  const html = await fetchText(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`);
  return parseDuckDuckGo(html);
}

async function searchGoogleNews(query) {
  const xml = await fetchText(
    `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=ko&gl=KR&ceid=KR:ko`,
  );
  return parseGoogleNews(xml);
}

async function searchWikipedia(query) {
  const url =
    "https://ko.wikipedia.org/w/api.php?action=query&list=search&format=json&utf8=1&origin=*&srlimit=5&srsearch=" +
    encodeURIComponent(query);
  const response = await fetch(url, { signal: AbortSignal.timeout(7000) });
  if (!response.ok) throw new Error(`wikipedia upstream ${response.status}`);
  const payload = await response.json();
  return (payload?.query?.search ?? []).slice(0, 5).map((item) => ({
    title: item.title,
    url: `https://ko.wikipedia.org/wiki/${encodeURIComponent(item.title.replace(/ /g, "_"))}`,
    snippet: cleanText(item.snippet),
    source: "Wikipedia",
  }));
}

function looksNewsLike(query) {
  return /(오늘|어제|이번|최근|최신|뉴스|속보|발표|출시|업데이트|주가|시세|가격|경기|점수|순위|202[5-9]|203\d)/i.test(query);
}

export default async function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).json({ error: "GET only" });
  }

  const query = String(request.query?.q ?? "").trim().slice(0, 300);
  if (!query) return response.status(400).json({ error: "검색어가 없습니다." });

  response.setHeader("Cache-Control", "s-maxage=120, stale-while-revalidate=600");

  const tasks = [searchDuckDuckGo(query)];
  if (looksNewsLike(query)) tasks.push(searchGoogleNews(query));

  const settled = await Promise.allSettled(tasks);
  let results = settled
    .filter((item) => item.status === "fulfilled")
    .flatMap((item) => item.value);

  const seen = new Set();
  results = results.filter((item) => {
    const key = item.url.replace(/[#?].*$/, "");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  if (results.length < 2) {
    try {
      const wiki = await searchWikipedia(query);
      results.push(...wiki.filter((item) => !seen.has(item.url)));
    } catch {
      // Search is best-effort. Chat will still work without web results.
    }
  }

  return response.status(200).json({
    query,
    searchedAt: new Date().toISOString(),
    results: results.slice(0, 7),
  });
}
