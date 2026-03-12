import { searchApps } from '../lib/logo-service.js';

export default async function handler(req, res) {
    const q = typeof req.query?.q === 'string' ? req.query.q.trim() : '';

    if (!q) {
        return res.status(400).json({ error: 'Missing required query parameter: q' });
    }

    if (q.length > 120) {
        return res.status(400).json({ error: 'Query is too long' });
    }

    try {
        const results = await searchApps(q);
        return res.status(200).json({
            query: q,
            count: results.length,
            results,
        });
    } catch (error) {
        console.error('Search endpoint failed:', error);
        return res.status(500).json({ error: 'Search failed' });
    }
}
