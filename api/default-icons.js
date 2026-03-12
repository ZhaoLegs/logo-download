import { getDefaultBackgroundIcons } from '../lib/logo-service.js';

export default async function handler(_req, res) {
    try {
        const icons = await getDefaultBackgroundIcons();
        return res.status(200).json({
            count: icons.length,
            icons,
        });
    } catch (error) {
        console.error('Default icons endpoint failed:', error);
        return res.status(500).json({ error: 'Default icon preload failed' });
    }
}
