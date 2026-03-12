import { fetchIconAsset } from '../lib/logo-service.js';

export default async function handler(req, res) {
    const targetUrl = typeof req.query?.url === 'string' ? req.query.url : '';

    try {
        const { buffer, contentType } = await fetchIconAsset(targetUrl);
        res.setHeader('content-type', contentType);
        res.setHeader('cache-control', 'public, max-age=86400');
        return res.status(200).send(buffer);
    } catch (error) {
        const statusCode = error?.statusCode || 500;
        const message = statusCode >= 500 ? 'Icon download failed' : error.message;
        console.error('Icon proxy failed:', error);
        return res.status(statusCode).json({ error: message });
    }
}
