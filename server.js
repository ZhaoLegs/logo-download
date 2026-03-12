import express from 'express';
import { load } from 'cheerio';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CheerioCrawler, log } from 'crawlee';

log.setLevel(log.LEVELS.ERROR);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CRAWLEE_STORAGE_DIR = path.join(__dirname, 'storage');
const PORT = Number(process.env.PORT) || 3000;
const SEARCH_CACHE_TTL = 5 * 60 * 1000;
const DEFAULT_ICONS_CACHE_TTL = 7 * 24 * 60 * 60 * 1000;

fs.mkdirSync(CRAWLEE_STORAGE_DIR, { recursive: true });
process.env.CRAWLEE_STORAGE_DIR = CRAWLEE_STORAGE_DIR;

const app = express();
const searchCache = new Map();
const defaultIconsCache = {
    icons: null,
    timestamp: 0,
    promise: null,
};

const CHINESE_APP_MAP = {
    '抖音': 'TikTok',
    '微信': 'WeChat',
    '支付宝': 'Alipay',
    '淘宝': 'Taobao',
    '京东': 'JD',
    '美团': 'Meituan',
    '钉钉': 'DingTalk',
    '腾讯': 'Tencent',
    '百度': 'Baidu',
    '哔哩哔哩': 'Bilibili',
    '网易云音乐': 'NetEase Music',
    '知乎': 'Zhihu',
    '小红书': 'rednote',
    '快手': 'Kwai',
    '饿了么': 'Ele.me',
    '拼多多': 'Pinduoduo',
    '微博': 'Weibo',
    '豆瓣': 'Douban',
};

const DEFAULT_BACKGROUND_APPS = [
    'Instagram',
    'TikTok',
    'WhatsApp',
    'Discord',
    'Spotify',
    'YouTube',
    'Notion',
    'Google Maps',
    'Amazon',
    'Kindle',
    'Airbnb',
    'PayPal',
    'Zoom',
];

const DEFAULT_BACKGROUND_ICON_FALLBACKS = [
    'https://play-lh.googleusercontent.com/VRMWkE5p3CkWhJs6nv-9ZsLAs1QOg5ob1_3qg-rckwYW7yp1fMrYZqnEFpk0IoVP4LM',
    'https://play-lh.googleusercontent.com/BmUViDVOKNJe0GYJe22hsr7juFndRVbvr1fGmHGXqHfJjNAXjd26bfuGRQpVrpJ6YbA',
    'https://play-lh.googleusercontent.com/bYtqbOcTYOlgc6gqZ2rwb8lptHuwlNE75zYJu6Bn076-hTmvd96HH-6v7S0YUAAJXoJN',
    'https://play-lh.googleusercontent.com/0oO5sAneb9lJP6l8c6DH4aj6f85qNpplQVHmPmbbBxAukDnlO7DarDW0b-kEIHa8SQ',
    'https://play-lh.googleusercontent.com/vaxxIC1qaXOd1q1hmL7c66N-Mp4LXuQIuBZGM0dPIbwmyWcJAXbhIIZ8hNBWvar54c_j',
    'https://play-lh.googleusercontent.com/yZsmiNjmji3ZoOuLthoVvptLB9cZ0vCmitcky4OUXNcEFV3IEQkrBD2uu5kuWRF5_ERA',
    'https://play-lh.googleusercontent.com/xOKbvDt362x1uzW-nnggP-PgO9HM4L1vwBl5HgHFHy_n1X3mqeBtOSoIyNJzTS3rrj70',
];

function normalizeSearchTerm(text) {
    if (!text) return '';
    let term = text.trim();
    term = term.replace(/(图标|应用|软件)/g, ' ');
    term = term.replace(/\b(icon|logo|app|application)\b/gi, ' ');
    term = term.replace(/\s+/g, ' ').trim();
    return term;
}

function isChineseQuery(text) {
    return /[\u4e00-\u9fa5]/.test(text);
}

function extractAppIdFromInput(input) {
    if (!input) return null;

    const trimmed = input.trim();
    const directIdMatch = trimmed.match(/^id?(\d{6,12})$/i);
    if (directIdMatch) return directIdMatch[1];

    const urlIdMatch = trimmed.match(/id(\d{6,12})/);
    if (urlIdMatch) return urlIdMatch[1];

    return null;
}

function sanitizeName(name) {
    return (name || '').trim().replace(/\s+/g, ' ');
}

function scoreSearchMatch(name, term) {
    const cleanName = sanitizeName(name).toLowerCase();
    const cleanTerm = normalizeSearchTerm(term).toLowerCase();

    if (!cleanName || !cleanTerm) return 0;
    if (cleanName === cleanTerm) return 100;
    if (cleanName.startsWith(cleanTerm)) return 80;
    if (cleanName.includes(cleanTerm)) return 60;

    const searchTerms = cleanTerm.split(/\s+/).filter(Boolean);
    const nameTerms = cleanName.split(/\s+/).filter(Boolean);
    if (!searchTerms.length || !nameTerms.length) return 0;

    const matchCount = searchTerms.filter((searchTerm) =>
        nameTerms.some((nameTerm) => nameTerm.includes(searchTerm))
    ).length;

    return (matchCount / searchTerms.length) * 40;
}

function scoreItunesResult(app, term) {
    const relevanceScore = scoreSearchMatch(app.trackName, term);
    const ratingScore = (app.averageUserRating || 0) * 20;
    const popularityScore = Math.min(Math.log10(app.userRatingCount || 1) * 10, 100);
    const releaseScore = app.releaseDate
        ? Math.min((Date.now() - new Date(app.releaseDate).getTime()) / (1000 * 60 * 60 * 24 * 365), 5) * 10
        : 0;

    return {
        relevanceScore,
        ratingScore,
        popularityScore,
        releaseScore,
        totalScore: relevanceScore * 0.4 + ratingScore * 0.3 + popularityScore * 0.2 + releaseScore * 0.1,
    };
}

function rescoreResultsForQuery(results, term) {
    return results.map((result) => {
        const rescoredRelevance = scoreSearchMatch(result.trackName, term);
        if (rescoredRelevance <= (result.relevanceScore || 0)) {
            return result;
        }

        if (result.source === 'app-store') {
            const ratingScore = result.ratingScore ?? ((result.averageUserRating || 0) * 20);
            const popularityScore = result.popularityScore ?? Math.min(Math.log10(result.userRatingCount || 1) * 10, 100);
            const releaseScore = result.releaseScore ?? (
                result.releaseDate
                    ? Math.min((Date.now() - new Date(result.releaseDate).getTime()) / (1000 * 60 * 60 * 24 * 365), 5) * 10
                    : 0
            );

            return {
                ...result,
                relevanceScore: rescoredRelevance,
                ratingScore,
                popularityScore,
                releaseScore,
                totalScore: rescoredRelevance * 0.4 + ratingScore * 0.3 + popularityScore * 0.2 + releaseScore * 0.1,
            };
        }

        return {
            ...result,
            relevanceScore: rescoredRelevance,
            totalScore: rescoredRelevance * 0.75,
        };
    });
}

async function fetchJson(url) {
    const response = await fetch(url, {
        headers: {
            'accept': 'application/json',
            'user-agent': 'logo-download/1.0',
        },
    });

    if (!response.ok) {
        throw new Error(`Request failed with ${response.status}`);
    }

    return response.json();
}

async function searchItunesInRegion(term, region) {
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&media=software&entity=software,iPadSoftware&limit=50&country=${region}`;

    try {
        const data = await fetchJson(url);
        if (!data.results?.length) return [];

        return data.results
            .filter((appResult) => appResult.artworkUrl100 || appResult.artworkUrl512)
            .map((appResult) => {
                const scores = scoreItunesResult(appResult, term);
                return {
                    ...appResult,
                    artworkUrl512: appResult.artworkUrl512 ||
                        (appResult.artworkUrl100 ? appResult.artworkUrl100.replace('100x100', '512x512') : appResult.artworkUrl100),
                    artworkUrl100: appResult.artworkUrl100 || appResult.artworkUrl512,
                    source: 'app-store',
                    store: 'App Store',
                    region,
                    ...scores,
                };
            });
    } catch (error) {
        console.error(`iTunes search failed for ${region}:`, error.message);
        return [];
    }
}

async function searchByAppId(appId, regionOrder) {
    const allResults = [];

    for (const region of regionOrder) {
        try {
            const data = await fetchJson(
                `https://itunes.apple.com/lookup?id=${encodeURIComponent(appId)}&country=${region}`
            );

            if (!data.results?.length) continue;

            const results = data.results
                .filter((appResult) => appResult.artworkUrl100 || appResult.artworkUrl512)
                .map((appResult) => ({
                    ...appResult,
                    artworkUrl512: appResult.artworkUrl512 ||
                        (appResult.artworkUrl100 ? appResult.artworkUrl100.replace('100x100', '512x512') : appResult.artworkUrl100),
                    artworkUrl100: appResult.artworkUrl100 || appResult.artworkUrl512,
                    source: 'app-store',
                    store: 'App Store',
                    region,
                    relevanceScore: 100,
                    totalScore: 100,
                }));

            allResults.push(...results);
        } catch (error) {
            console.error(`iTunes lookup failed for ${region}:`, error.message);
        }
    }

    return allResults;
}

async function fetchDefaultBackgroundIcon(appName) {
    const results = await searchItunesInRegion(appName, 'us');
    const topResult = results[0];
    return topResult?.artworkUrl512 || topResult?.artworkUrl100 || null;
}

async function mapWithConcurrency(items, concurrency, worker) {
    const results = new Array(items.length);
    let currentIndex = 0;

    async function runWorker() {
        while (currentIndex < items.length) {
            const itemIndex = currentIndex;
            currentIndex += 1;
            results[itemIndex] = await worker(items[itemIndex], itemIndex);
        }
    }

    await Promise.all(
        Array.from({ length: Math.min(concurrency, items.length) }, () => runWorker())
    );

    return results;
}

function normalizeGooglePlayIconUrl(url) {
    if (!url) return '';
    return url.replace(/=w\d+-h\d+(?:-rw)?$/, '=s512-rw').replace(/=s\d+(?:-rw)?$/, '=s512-rw');
}

function iconDedupKey(url) {
    if (!url) return '';
    return url.replace(/=w\d+-h\d+(?:-rw)?$/, '').replace(/=s\d+(?:-rw)?$/, '');
}

function collectGooglePlayResults($, term) {
    const results = [];
    const seen = new Set();

    $('a[href^="/store/apps/details?id="]').each((_, element) => {
        const anchor = $(element);
        const href = anchor.attr('href');
        const card = anchor.parent();
        const title = sanitizeName(anchor.attr('aria-label') || card.find('.vWM94c').first().text());
        const developer = sanitizeName(card.find('.LbQbAe').first().text());
        const iconUrl = normalizeGooglePlayIconUrl(
            card.find('img[itemprop="image"], img[alt="Icon image"]').first().attr('src') ||
            card.find('img').first().attr('src') ||
            ''
        );

        if (!href || !title || !iconUrl || seen.has(href)) return;

        seen.add(href);

        const relevanceScore = scoreSearchMatch(title, term);
        if (relevanceScore < 30) return;

        results.push({
            trackName: title,
            sellerName: developer,
            artworkUrl512: iconUrl,
            artworkUrl100: iconUrl,
            trackViewUrl: `https://play.google.com${href}`,
            source: 'google-play',
            store: 'Google Play',
            relevanceScore,
            totalScore: relevanceScore * 0.75,
        });
    });

    return results;
}

async function searchGooglePlayWithHtmlFallback(term) {
    try {
        const response = await fetch(
            `https://play.google.com/store/search?q=${encodeURIComponent(term)}&c=apps&hl=en_US&gl=US`,
            {
                headers: {
                    'accept-language': 'en-US,en;q=0.9',
                    'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                },
            }
        );

        if (!response.ok) {
            throw new Error(`Request failed with ${response.status}`);
        }

        const html = await response.text();
        return collectGooglePlayResults(load(html), term).slice(0, 20);
    } catch (error) {
        console.error('Google Play HTML fallback failed:', error.message);
        return [];
    }
}

async function searchGooglePlayWithCrawlee(term) {
    let results = [];

    const crawler = new CheerioCrawler({
        maxConcurrency: 1,
        maxRequestsPerCrawl: 1,
        requestHandlerTimeoutSecs: 15,
        async requestHandler({ $ }) {
            results = collectGooglePlayResults($, term);
        },
        failedRequestHandler({ error }) {
            console.error('Google Play crawl failed:', error?.message || error);
        },
    });

    try {
        await crawler.run([
            `https://play.google.com/store/search?q=${encodeURIComponent(term)}&c=apps&hl=en_US&gl=US`,
        ]);
    } catch (error) {
        console.error('Google Play crawler run failed:', error.message);
    }

    if (results.length > 0) {
        return results.slice(0, 20);
    }

    return searchGooglePlayWithHtmlFallback(term);
}

function hasStrongMatch(results) {
    return results.some((result) => (result.relevanceScore || 0) >= 80);
}

function filterIrrelevantResults(results) {
    if (!results.some((result) => (result.relevanceScore || 0) > 0)) {
        return results;
    }

    return results.filter((result) => (result.relevanceScore || 0) > 0);
}

async function searchAcrossRegions(term, regionOrder) {
    const results = [];

    for (const region of regionOrder) {
        const regionalResults = await searchItunesInRegion(term, region);
        results.push(...regionalResults);
    }

    return results;
}

function normalizedResultKey(result) {
    const key = sanitizeName(result.trackName)
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, '');

    return key || result.trackViewUrl || result.artworkUrl512;
}

function sortAndDedupeResults(results, searchTerm) {
    const rankedResults = results
        .map((result, index) => ({
            ...result,
            sourcePriority: result.source === 'app-store' ? 2 : 1,
            finalScore: typeof result.totalScore === 'number'
                ? result.totalScore + (result.source === 'app-store' ? 3 : 0)
                : scoreSearchMatch(result.trackName, searchTerm),
            originalIndex: index,
        }))
        .sort((left, right) =>
            right.finalScore - left.finalScore ||
            right.sourcePriority - left.sourcePriority ||
            left.originalIndex - right.originalIndex
        );

    const seen = new Set();
    const deduped = [];

    for (const result of rankedResults) {
        const key = normalizedResultKey(result);
        if (seen.has(key)) continue;
        seen.add(key);
        deduped.push(result);
    }

    return deduped.slice(0, 30).map(({ finalScore, sourcePriority, originalIndex, ...result }) => result);
}

function getCachedSearch(cacheKey) {
    const cached = searchCache.get(cacheKey);
    if (!cached) return null;

    if (Date.now() - cached.timestamp > SEARCH_CACHE_TTL) {
        searchCache.delete(cacheKey);
        return null;
    }

    return cached.data;
}

function setCachedSearch(cacheKey, data) {
    if (!Array.isArray(data) || data.length === 0) {
        searchCache.delete(cacheKey);
        return;
    }

    searchCache.set(cacheKey, {
        timestamp: Date.now(),
        data,
    });
}

async function getDefaultBackgroundIcons() {
    if (
        defaultIconsCache.icons &&
        Date.now() - defaultIconsCache.timestamp < DEFAULT_ICONS_CACHE_TTL
    ) {
        return defaultIconsCache.icons;
    }

    if (defaultIconsCache.promise) {
        return defaultIconsCache.promise;
    }

    defaultIconsCache.promise = (async () => {
        const resolvedIcons = await mapWithConcurrency(
            DEFAULT_BACKGROUND_APPS,
            2,
            (appName) => fetchDefaultBackgroundIcon(appName)
        );

        const icons = [];
        const seen = new Set();

        for (const iconUrl of resolvedIcons) {
            const key = iconDedupKey(iconUrl);
            if (!iconUrl || seen.has(key)) continue;

            seen.add(key);
            icons.push(iconUrl);
        }

        for (const iconUrl of DEFAULT_BACKGROUND_ICON_FALLBACKS) {
            const key = iconDedupKey(iconUrl);
            if (seen.has(key)) continue;
            seen.add(key);
            icons.push(iconUrl);
        }

        defaultIconsCache.icons = icons;
        defaultIconsCache.timestamp = Date.now();
        return icons;
    })();

    try {
        return await defaultIconsCache.promise;
    } finally {
        defaultIconsCache.promise = null;
    }
}

async function searchApps(rawQuery) {
    const normalizedTerm = normalizeSearchTerm(rawQuery);
    const searchKey = normalizedTerm || rawQuery.trim();
    const mappedSearchTerm = CHINESE_APP_MAP[searchKey] || searchKey;
    const isChineseSearch = isChineseQuery(searchKey);
    const regionOrder = isChineseSearch ? ['cn', 'us'] : ['us', 'cn'];
    const cacheKey = `${regionOrder.join(',')}::${rawQuery}`;

    const cached = getCachedSearch(cacheKey);
    if (cached) return cached;

    let results = [];
    const appId = extractAppIdFromInput(rawQuery);

    if (appId) {
        results = await searchByAppId(appId, regionOrder);
        if (results.length > 0) {
            const deduped = sortAndDedupeResults(results, searchKey);
            setCachedSearch(cacheKey, deduped);
            return deduped;
        }
    }

    results.push(...await searchAcrossRegions(mappedSearchTerm, regionOrder));

    if (
        mappedSearchTerm !== searchKey &&
        (results.length === 0 || !hasStrongMatch(results))
    ) {
        results.push(...await searchAcrossRegions(searchKey, regionOrder));
    }

    if (mappedSearchTerm !== searchKey) {
        results = rescoreResultsForQuery(results, searchKey);
        results = filterIrrelevantResults(results);
    }

    if (!hasStrongMatch(results)) {
        const crawlerResults = await searchGooglePlayWithCrawlee(rawQuery.trim());
        results.push(...crawlerResults);
    }

    const deduped = sortAndDedupeResults(results, searchKey);
    setCachedSearch(cacheKey, deduped);
    return deduped;
}

function isAllowedIconHost(hostname) {
    return hostname === 'play-lh.googleusercontent.com' ||
        hostname.endsWith('.mzstatic.com') ||
        hostname.endsWith('.apple.com');
}

app.get('/api/search', async (req, res) => {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';

    if (!q) {
        return res.status(400).json({ error: 'Missing required query parameter: q' });
    }

    if (q.length > 120) {
        return res.status(400).json({ error: 'Query is too long' });
    }

    try {
        const results = await searchApps(q);
        return res.json({
            query: q,
            count: results.length,
            results,
        });
    } catch (error) {
        console.error('Search endpoint failed:', error);
        return res.status(500).json({ error: 'Search failed' });
    }
});

app.get('/api/default-icons', async (_req, res) => {
    try {
        const icons = await getDefaultBackgroundIcons();
        return res.json({
            count: icons.length,
            icons,
        });
    } catch (error) {
        console.error('Default icons endpoint failed:', error);
        return res.status(500).json({ error: 'Default icon preload failed' });
    }
});

app.get('/api/icon', async (req, res) => {
    const targetUrl = typeof req.query.url === 'string' ? req.query.url : '';

    if (!targetUrl) {
        return res.status(400).json({ error: 'Missing required query parameter: url' });
    }

    let parsedUrl;
    try {
        parsedUrl = new URL(targetUrl);
    } catch {
        return res.status(400).json({ error: 'Invalid url parameter' });
    }

    if (parsedUrl.protocol !== 'https:' || !isAllowedIconHost(parsedUrl.hostname)) {
        return res.status(400).json({ error: 'Icon host is not allowed' });
    }

    try {
        const response = await fetch(parsedUrl, {
            headers: {
                'user-agent': 'logo-download/1.0',
            },
        });

        if (!response.ok) {
            return res.status(502).json({ error: 'Unable to fetch icon' });
        }

        const arrayBuffer = await response.arrayBuffer();
        const contentType = response.headers.get('content-type') || 'image/png';

        res.setHeader('content-type', contentType);
        res.setHeader('cache-control', 'public, max-age=86400');
        return res.send(Buffer.from(arrayBuffer));
    } catch (error) {
        console.error('Icon proxy failed:', error);
        return res.status(500).json({ error: 'Icon download failed' });
    }
});
app.get('/', (_req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/index.html', (_req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/script.js', (_req, res) => {
    res.type('application/javascript');
    res.sendFile(path.join(__dirname, 'script.js'));
});

app.get('/style.css', (_req, res) => {
    res.type('text/css');
    res.sendFile(path.join(__dirname, 'style.css'));
});

app.get('/favicon.ico', (_req, res) => {
    res.status(204).end();
});

app.listen(PORT, () => {
    console.log(`logo-download server running at http://localhost:${PORT}`);
});
