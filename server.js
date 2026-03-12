import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchIconAsset, getDefaultBackgroundIcons, searchApps } from './lib/logo-service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.PORT) || 3000;

const app = express();

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

    try {
        const { buffer, contentType } = await fetchIconAsset(targetUrl);
        res.setHeader('content-type', contentType);
        res.setHeader('cache-control', 'public, max-age=86400');
        return res.send(buffer);
    } catch (error) {
        const statusCode = error?.statusCode || 500;
        const message = statusCode >= 500 ? 'Icon download failed' : error.message;
        console.error('Icon proxy failed:', error);
        return res.status(statusCode).json({ error: message });
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
