class AppStartupIconDownload {
    constructor() {
        this.initializeElements();
        this.initializeEventListeners();
        this.setupLoading();
        this.setupToast();
        this.setupFallingIcons();
        this.animationInterval = null;
        this.searchInput.placeholder = 'Enter app name';  // 搜索框占位符
        this.cache = new Map(); // 添加缓存
        this.lastSearchTerm = ''; // 记录上次搜索词
        this.setupWelcomeTitle();
        this.setupTwitterLink();
        this.setupChineseAppMap();
    }

    initializeElements() {
        this.searchInput = document.getElementById('searchInput');
        this.resultsContainer = document.getElementById('results');
    }

    trackAnalytics(eventName, data = {}) {
        if (!window.umami || typeof window.umami.track !== 'function') {
            return;
        }

        try {
            window.umami.track(eventName, data);
        } catch (error) {
            console.warn('Analytics track failed:', error);
        }
    }

    buildSearchAnalyticsPayload(rawTerm, searchKey) {
        const trimmedTerm = (rawTerm || '').trim();
        const queryType = this.extractAppIdFromInput(trimmedTerm)
            ? 'app_id'
            : this.isChineseQuery(searchKey)
                ? 'chinese'
                : 'keyword';

        return {
            query: trimmedTerm.slice(0, 80),
            normalized_query: searchKey.slice(0, 80),
            query_type: queryType,
            query_length: trimmedTerm.length
        };
    }

    trackSearchResults(payload, results, source) {
        const firstResult = Array.isArray(results) ? results[0] : null;

        this.trackAnalytics('search_results', {
            ...payload,
            results_count: Array.isArray(results) ? results.length : 0,
            result_source: source,
            top_store: firstResult?.store || firstResult?.source || 'unknown',
            top_app: (firstResult?.trackName || '').slice(0, 80)
        });
    }

    initializeEventListeners() {
        // 监听输入框内容变化
        this.searchInput.addEventListener('input', () => {
            clearTimeout(this.searchTimeout);
            
            // 当输入框为空时
            if (!this.searchInput.value.trim()) {
                this.resultsContainer.innerHTML = '';
                document.body.classList.remove('has-results');
                // 重新加载欢迎文字
                this.reloadWelcomeTitle();
            }
            
            this.searchTimeout = setTimeout(() => this.performSearch(), 500);
        });

        // 监听输入框清空事件（比如点击清除按钮）
        this.searchInput.addEventListener('search', () => {
            if (!this.searchInput.value.trim()) {
                this.resultsContainer.innerHTML = '';
            }
        });

        document.querySelector('.clear-button').addEventListener('click', () => {
            this.searchInput.value = '';
            this.searchInput.focus();
            this.resultsContainer.innerHTML = '';
            document.body.classList.remove('has-results');
            this.reloadWelcomeTitle();
        });
    }

    setupLoading() {
        // 创建容器
        const loadingContainer = document.createElement('div');
        loadingContainer.className = 'loading-container';
        
        const loadingBox = document.createElement('div');
        loadingBox.className = 'loading-box';

        // 创建 loading 元素
        const loading = document.createElement('div');
        loading.className = 'loading';
        
        // 组装
        loadingBox.appendChild(loading);
        loadingContainer.appendChild(loadingBox);
        document.body.appendChild(loadingContainer);
        this.loadingElement = loadingContainer;
    }

    showLoading() {
        if (this.loadingElement) {
            this.loadingElement.classList.add('active');
        }
    }

    hideLoading() {
        if (this.loadingElement) {
            this.loadingElement.classList.remove('active');
        }
    }

    setupToast() {
        this.toast = document.createElement('div');
        this.toast.className = 'toast';
        document.body.appendChild(this.toast);
    }

    showToast(message, duration = 3000) {
        const toast = document.querySelector('.toast');
        toast.textContent = message;
        toast.classList.add('show');
        
        setTimeout(() => {
            toast.classList.remove('show');
        }, duration);
    }

    setupChineseAppMap() {
        this.chineseAppMap = {
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
            '豆瓣': 'Douban'
        };
    }

    // 判断是否包含中文字符
    isChineseQuery(text) {
        return /[\u4e00-\u9fa5]/.test(text);
    }

    normalizeSearchTerm(text) {
        if (!text) return '';
        let term = text.trim();
        term = term.replace(/(图标|应用|软件)/g, ' ');
        term = term.replace(/\b(icon|logo|app|application)\b/gi, ' ');
        term = term.replace(/\s+/g, ' ').trim();
        return term;
    }

    // 使用 JSONP 调用 iTunes Search / Lookup，绕过 CORS 限制
    jsonpRequest(url, callbackParam = 'callback') {
        return new Promise((resolve, reject) => {
            const callbackName = `itunesJsonp_${Date.now()}_${Math.random().toString(36).slice(2)}`;
            const separator = url.includes('?') ? '&' : '?';
            const script = document.createElement('script');
            script.src = `${url}${separator}${callbackParam}=${callbackName}`;
            script.async = true;

            const cleanup = () => {
                if (script.parentNode) {
                    script.parentNode.removeChild(script);
                }
                try {
                    delete window[callbackName];
                } catch (e) {
                    window[callbackName] = undefined;
                }
            };

            window[callbackName] = (data) => {
                cleanup();
                resolve(data);
            };

            script.onerror = () => {
                cleanup();
                reject(new Error('JSONP request failed'));
            };

            document.body.appendChild(script);

            // 超时保护，防止一直挂起
            setTimeout(() => {
                if (window[callbackName]) {
                    cleanup();
                    reject(new Error('JSONP request timeout'));
                }
            }, 10000);
        });
    }

    async fetchViaJina(url) {
        const response = await fetch(`https://r.jina.ai/${url}`, {
            headers: {
                'Accept': 'text/plain'
            }
        });

        if (!response.ok) {
            throw new Error(`Proxy request failed: ${response.status}`);
        }

        const text = await response.text();
        const jsonStart = text.indexOf('{');
        if (jsonStart === -1) {
            throw new Error('Proxy response missing JSON');
        }

        return JSON.parse(text.slice(jsonStart));
    }

    async requestItunesJson(url) {
        if (window.location.protocol.startsWith('http')) {
            try {
                const response = await fetch(`/api/itunes?url=${encodeURIComponent(url)}`, {
                    headers: {
                        'Accept': 'application/json'
                    }
                });
                if (response.ok) {
                    return await response.json();
                }
            } catch (_) {
            }
        }

        return await this.jsonpRequest(url);
    }

    // 从输入中提取 App Store ID（支持直接输入 ID 或整条链接）
    extractAppIdFromInput(input) {
        if (!input) return null;

        const trimmed = input.trim();

        // 1) 直接输入 id123456789 或 123456789
        const directIdMatch = trimmed.match(/^id?(\d{6,12})$/i);
        if (directIdMatch) {
            return directIdMatch[1];
        }

        // 2) App Store 链接，如：https://apps.apple.com/.../id123456789
        const urlIdMatch = trimmed.match(/id(\d{6,12})/);
        if (urlIdMatch) {
            return urlIdMatch[1];
        }

        return null;
    }

    // 通过 App Store 的 lookup 接口按 ID 精准获取 App 信息
    async searchByAppId(appId, regionOrder = ['us', 'cn']) {
        for (const region of regionOrder) {
            try {
                const data = await this.requestItunesJson(
                    `https://itunes.apple.com/lookup?id=${encodeURIComponent(appId)}&country=${region}`
                );
                if (!data.results || data.results.length === 0) continue;

                // 与 searchInRegion 的结果结构尽量保持一致
                const processedResults = data.results
                    .filter(app => app.artworkUrl100 || app.artworkUrl512)
                    .map(app => ({
                        ...app,
                        artworkUrl512: app.artworkUrl512 ||
                            (app.artworkUrl100 ? app.artworkUrl100.replace('100x100', '512x512') : app.artworkUrl100)
                    }));

                if (processedResults.length > 0) {
                    return processedResults;
                }
            } catch (error) {
                console.error(`Lookup error in ${region}:`, error);
            }
        }

        return null;
    }

    async searchAcrossRegions(term, regionOrder) {
        let results = null;

        for (const region of regionOrder) {
            const regionalResults = await this.searchInRegion(term, region);
            if (regionalResults && regionalResults.length > 0) {
                results = [...(results || []), ...regionalResults];
            }
        }

        return results;
    }

    rescoreResultsForQuery(results, term) {
        return (results || []).map((app) => {
            const nameLower = (app.trackName || '').toLowerCase();
            const searchLower = term.toLowerCase();
            let relevanceScore = 0;

            if (nameLower === searchLower) {
                relevanceScore = 100;
            } else if (nameLower.startsWith(searchLower)) {
                relevanceScore = 80;
            } else if (nameLower.includes(searchLower)) {
                relevanceScore = 60;
            } else {
                const searchTerms = searchLower.split(/\s+/).filter(Boolean);
                const nameTerms = nameLower.split(/\s+/).filter(Boolean);
                const matchCount = searchTerms.filter((searchTerm) =>
                    nameTerms.some((nameTerm) => nameTerm.includes(searchTerm))
                ).length;
                relevanceScore = searchTerms.length ? (matchCount / searchTerms.length) * 40 : 0;
            }

            if (relevanceScore <= (app.relevanceScore || 0)) {
                return app;
            }

            const ratingScore = app.ratingScore ?? ((app.averageUserRating || 0) * 20);
            const popularityScore = app.popularityScore ?? Math.min(Math.log10(app.userRatingCount || 1) * 10, 100);
            const releaseScore = app.releaseScore ?? (app.releaseDate ?
                Math.min((new Date() - new Date(app.releaseDate)) / (1000 * 60 * 60 * 24 * 365), 5) * 10 : 0);

            return {
                ...app,
                relevanceScore,
                ratingScore,
                popularityScore,
                releaseScore,
                totalScore: relevanceScore * 0.4 + ratingScore * 0.3 + popularityScore * 0.2 + releaseScore * 0.1
            };
        });
    }

    filterIrrelevantResults(results) {
        const apps = results || [];
        if (!apps.some((app) => (app.relevanceScore || 0) > 0)) {
            return apps;
        }

        return apps.filter((app) => (app.relevanceScore || 0) > 0);
    }

    async searchWithBackend(rawTerm) {
        if (!rawTerm || !window.location.protocol.startsWith('http')) {
            return null;
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);

        try {
            const response = await fetch(`/api/search?q=${encodeURIComponent(rawTerm)}`, {
                signal: controller.signal,
                headers: {
                    'Accept': 'application/json'
                }
            });

            if (!response.ok) {
                return null;
            }

            const payload = await response.json();
            return Array.isArray(payload.results) ? payload.results : null;
        } catch (error) {
            console.warn('Backend search unavailable, falling back to JSONP:', error);
            return null;
        } finally {
            clearTimeout(timeoutId);
        }
    }

    buildIconDownloadUrl(iconUrl) {
        if (!iconUrl) return '';
        if (window.location.protocol.startsWith('http')) {
            return `/api/icon?url=${encodeURIComponent(iconUrl)}`;
        }
        return iconUrl;
    }

    escapeHtml(value) {
        return String(value ?? '').replace(/[&<>"']/g, (char) => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        }[char]));
    }

    async performSearch() {
        const rawTerm = this.searchInput.value.trim();
        if (!rawTerm) return;
        const normalizedTerm = this.normalizeSearchTerm(rawTerm);
        const searchKey = normalizedTerm || rawTerm;
        const analyticsPayload = this.buildSearchAnalyticsPayload(rawTerm, searchKey);

        // 避免在无改变的情况下重复请求
        if (searchKey === this.lastSearchTerm && this.cache.has(searchKey)) {
            this.trackSearchResults(analyticsPayload, this.cache.get(searchKey), 'memory-cache');
            this.displayResults(this.cache.get(searchKey));
            return;
        }
        this.lastSearchTerm = searchKey;

        try {
            this.showLoading();
            this.trackAnalytics('search_started', analyticsPayload);

            // 检查缓存
            if (this.cache.has(searchKey)) {
                this.hideLoading();
                this.trackSearchResults(analyticsPayload, this.cache.get(searchKey), 'memory-cache');
                this.displayResults(this.cache.get(searchKey));
                return;
            }

            // 转换中文应用名称
            const searchQuery = this.chineseAppMap[searchKey] || searchKey;
            let results = null;

            // 优先尝试后端聚合搜索（iTunes + Crawlee）
            const backendResults = await this.searchWithBackend(rawTerm);
            if (backendResults && backendResults.length > 0) {
                this.cache.set(searchKey, backendResults);
                this.cleanCache();
                this.hideLoading();
                this.trackSearchResults(analyticsPayload, backendResults, 'backend-api');
                this.displayResults(backendResults);
                return;
            }

            // 判断搜索语言，决定搜索顺序
            const isChineseSearch = this.isChineseQuery(searchKey);

            // 优先处理 App Store 链接或 ID，提升精准度
            const appId = this.extractAppIdFromInput(rawTerm);
            if (appId) {
                const regionOrder = isChineseSearch ? ['cn', 'us'] : ['us', 'cn'];
                results = await this.searchByAppId(appId, regionOrder);
                if (results && results.length > 0) {
                    this.cache.set(searchKey, results);
                    this.cleanCache();
                    this.hideLoading();
                    this.trackSearchResults(analyticsPayload, results, 'app-id-lookup');
                    this.displayResults(results);
                    return;
                }
            }

            const regionOrder = isChineseSearch ? ['cn', 'us'] : ['us', 'cn'];
            results = await this.searchAcrossRegions(searchQuery, regionOrder);

            // 映射词结果不强时，补充原词结果再排序，避免把弱相关结果顶上来
            if (searchQuery !== searchKey) {
                const hasStrongMatch = (results || []).some(app => (app.relevanceScore || 0) >= 80);
                if (!results || results.length === 0 || !hasStrongMatch) {
                    const originalResults = await this.searchAcrossRegions(searchKey, regionOrder);
                    if (originalResults && originalResults.length > 0) {
                        results = [...(results || []), ...originalResults]
                            .filter((app, index, apps) => {
                                const appName = (app.trackName || '').toLowerCase().replace(/[^\w\u4e00-\u9fa5]+/g, '');
                                return index === apps.findIndex((candidate) =>
                                    ((candidate.trackName || '').toLowerCase().replace(/[^\w\u4e00-\u9fa5]+/g, '') === appName)
                                );
                            });
                    }
                }

                results = this.rescoreResultsForQuery(results, searchKey)
                    .sort((a, b) => (b.totalScore || 0) - (a.totalScore || 0));
                results = this.filterIrrelevantResults(results);
            }

            if (results && results.length > 0) {
                this.cache.set(searchKey, results);
                this.cleanCache();
                this.hideLoading();
                this.trackSearchResults(analyticsPayload, results, 'jsonp-fallback');
                this.displayResults(results);
            } else {
                this.hideLoading();
                this.resultsContainer.innerHTML = '';
                this.trackAnalytics('search_empty', analyticsPayload);
                this.showToast('No results found');
            }

        } catch (error) {
            console.error('Search error:', error);
            this.hideLoading();
            this.trackAnalytics('search_failed', {
                ...analyticsPayload,
                error_name: error?.name || 'Error'
            });
            this.showToast('Search failed, please try again');
        }
    }

    async searchInRegion(term, region) {
        try {
            const data = await this.requestItunesJson(
                `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&media=software&entity=software,iPadSoftware&limit=50&country=${region}`
            );
            if (!data.results || data.results.length === 0) return null;

            // 增强的搜索结果排序处理
            const processedResults = data.results
                .filter(app => app.artworkUrl100 || app.artworkUrl512)
                .map(app => {
                    // 计算相关性得分
                    const nameLower = app.trackName.toLowerCase();
                    const searchLower = term.toLowerCase();
                    let relevanceScore = 0;

                    // 完全匹配得分最高
                    if (nameLower === searchLower) {
                        relevanceScore = 100;
                    }
                    // 开头匹配次之
                    else if (nameLower.startsWith(searchLower)) {
                        relevanceScore = 80;
                    }
                    // 包含关键词再次
                    else if (nameLower.includes(searchLower)) {
                        relevanceScore = 60;
                    }
                    // 关键词分词匹配
                    else {
                        const searchTerms = searchLower.split(/\s+/);
                        const nameTerms = nameLower.split(/\s+/);
                        const matchCount = searchTerms.filter(term => 
                            nameTerms.some(nameTerm => nameTerm.includes(term))
                        ).length;
                        relevanceScore = (matchCount / searchTerms.length) * 40;
                    }

                    // 计算综合评分
                    const ratingScore = (app.averageUserRating || 0) * 20; // 满分100分
                    const popularityScore = Math.min(Math.log10(app.userRatingCount || 1) * 10, 100); // 满分100分
                    const releaseScore = app.releaseDate ? 
                        Math.min((new Date() - new Date(app.releaseDate)) / (1000 * 60 * 60 * 24 * 365), 5) * 10 : 0; // 最高50分

                    // 返回带有评分的结果
                    return {
                        ...app,
                        artworkUrl512: app.artworkUrl512 || 
                            (app.artworkUrl100 ? app.artworkUrl100.replace('100x100', '512x512') : app.artworkUrl100),
                        relevanceScore,
                        ratingScore,
                        popularityScore,
                        releaseScore,
                        totalScore: relevanceScore * 0.4 + // 相关性权重40%
                                   ratingScore * 0.3 + // 评分权重30%
                                   popularityScore * 0.2 + // 流行度权重20%
                                   releaseScore * 0.1 // 时效性权重10%
                    };
                })
                .sort((a, b) => {
                    // 优先按相关性分数排序
                    if (Math.abs(a.relevanceScore - b.relevanceScore) > 20) {
                        return b.relevanceScore - a.relevanceScore;
                    }
                    // 相关性接近时，按综合得分排序
                    return b.totalScore - a.totalScore;
                })
                .slice(0, 30);

            return processedResults;
        } catch (error) {
            console.error(`Search error in ${region}:`, error);
            return null;
        }
    }

    displayResults(results) {
        // 优化显示结果
        this.resultsContainer.innerHTML = results
            // 确保应用名称和图标都存在
            .filter(app => app.trackName && (app.artworkUrlMax || app.artworkUrl512 || app.artworkUrl100))
            .map(app => {
                // 处理应用名称，移除多余空格和特殊字符
                const cleanName = app.trackName.trim().replace(/\s+/g, ' ');
                const iconUrl = app.artworkUrl512 || app.artworkUrl100 || app.artworkUrlMax;
                const downloadSourceUrl = app.artworkUrlMax || app.artworkUrl512 || app.artworkUrl100;
                const appUrl = app.trackViewUrl || '';
                const downloadUrl = this.buildIconDownloadUrl(downloadSourceUrl);
                const appStore = app.store || app.source || 'unknown';
                
                return `
                    <div class="app-card">
                        <img src="${this.escapeHtml(iconUrl)}" 
                             alt="${this.escapeHtml(cleanName)}" 
                             class="app-icon"
                             data-app-url="${this.escapeHtml(appUrl)}"
                             data-app-store="${this.escapeHtml(appStore)}"
                             data-app-name="${this.escapeHtml(cleanName)}"
                             style="cursor: pointer;">
                        <h3 class="app-name">${this.escapeHtml(cleanName)}</h3>
                        <button class="download-btn" 
                                data-icon-url="${this.escapeHtml(iconUrl)}"
                                data-download-url="${this.escapeHtml(downloadUrl)}"
                                data-app-name="${this.escapeHtml(cleanName)}"
                                data-app-store="${this.escapeHtml(appStore)}">
                            Download
                        </button>
                    </div>
                `;
            })
            .join('');

        if (!document.body.classList.contains('has-results')) {
            requestAnimationFrame(() => {
                document.body.classList.add('has-results');
            });
        }

        // 图标点击事件
        this.resultsContainer.querySelectorAll('.app-icon').forEach(icon => {
            icon.addEventListener('click', (e) => {
                const appUrl = e.target.dataset.appUrl;
                if (appUrl) {
                    this.trackAnalytics('open_store', {
                        app_name: (e.target.dataset.appName || '').slice(0, 80),
                        store: e.target.dataset.appStore || 'unknown'
                    });
                    window.open(appUrl, '_blank');
                }
            });
        });

        // 下载按钮点击事件
        this.resultsContainer.querySelectorAll('.download-btn').forEach(button => {
            button.addEventListener('click', async (e) => {
                const iconUrl = e.target.dataset.downloadUrl || e.target.dataset.iconUrl;
                const appName = e.target.dataset.appName;
                const appStore = e.target.dataset.appStore || 'unknown';
                
                try {
                    const response = await fetch(iconUrl);
                    if (!response.ok) {
                        throw new Error(`Download request failed with status ${response.status}`);
                    }

                    const contentType = response.headers.get('content-type') || '';
                    if (contentType && !contentType.startsWith('image/')) {
                        throw new Error(`Unexpected content type: ${contentType}`);
                    }

                    const blob = await response.blob();
                    
                    // 创建下载链接
                    const downloadLink = document.createElement('a');
                    downloadLink.href = URL.createObjectURL(blob);
                    downloadLink.download = `${appName}-icon.png`;  // 设置下载文件名
                    
                    // 触发下载
                    document.body.appendChild(downloadLink);
                    downloadLink.click();
                    document.body.removeChild(downloadLink);
                    
                    // 清理 URL 对象
                    URL.revokeObjectURL(downloadLink.href);
                    
                    // 显示成功提示
                    this.trackAnalytics('download_icon', {
                        app_name: (appName || '').slice(0, 80),
                        store: appStore
                    });
                    this.showToast('Icon downloaded successfully');
                } catch (error) {
                    console.error('Download error:', error);
                    this.trackAnalytics('download_failed', {
                        app_name: (appName || '').slice(0, 80),
                        store: appStore
                    });
                    this.showToast('Download failed, please try again');
                }
            });
        });
    }

    async downloadIcon(url, appName) {
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Download request failed with status ${response.status}`);
            }

            const contentType = response.headers.get('content-type') || '';
            if (contentType && !contentType.startsWith('image/')) {
                throw new Error(`Unexpected content type: ${contentType}`);
            }

            const blob = await response.blob();
            const blobUrl = window.URL.createObjectURL(blob);
            
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = `${appName}-icon.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(blobUrl);
            
            this.showToast('Icon downloaded successfully');
        } catch (error) {
            console.error('Download error:', error);
            this.showToast('Download failed, please try again');
        }
    }

    setupFallingIcons() {
        this.fallingIconsContainer = document.querySelector('.falling-icons');
        this.iconUrls = new Set();
        this.fallingIconInterval = null;
        this.fallingIconTimeouts = [];
        this.isFallingIconsPaused = false;
        this.defaultApps = [
            // 社交媒体
            'Instagram', 'TikTok', 'WeChat', 'Facebook',
            'Twitter', 'LinkedIn', 'Snapchat', 'Pinterest',
            'Reddit', 'Tumblr', 'Line', 'Twitch',
            
            // 通讯工具
            'WhatsApp', 'Telegram', 'Discord', 'Messenger',
            'Skype', 'Signal', 'Viber', 'Slack',
            
            // 音乐和视频
            'Spotify', 'YouTube', 'Netflix', 'Disney+',
            'Apple Music', 'Prime Video', 'HBO Max', 'Hulu',
            'SoundCloud', 'Deezer', 'Tidal', 'Pandora',
            
            // 生产力工具
            'Microsoft Teams', 'Zoom', 'Notion', 'Trello',
            'Asana', 'Monday', 'Evernote', 'Todoist',
            'Microsoft Office', 'Google Drive', 'Dropbox', 'Box',
            
            // 金融和支付
            'PayPal', 'Venmo', 'Cash App', 'Stripe',
            'Coinbase', 'Robinhood', 'Square', 'Wise',
            
            // 出行和地图
            'Uber', 'Lyft', 'Google Maps', 'Waze',
            'Airbnb', 'Booking.com', 'Expedia', 'TripAdvisor',
            
            // 购物
            'Amazon', 'eBay', 'Shopify', 'Walmart',
            'Target', 'SHEIN', 'Wish', 'Etsy',
            
            // 新闻和阅读
            'Medium', 'Substack', 'Apple News', 'Flipboard',
            'Kindle', 'Audible', 'Pocket', 'Feedly',
            
            // 健康和运动
            'Strava', 'Nike Run Club', 'Fitbit', 'MyFitnessPal',
            'Calm', 'Headspace', 'Peloton', 'AllTrails'
        ];
        
        this.loadIconsFromCache();
        this.resumeFallingIcons();

        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.pauseFallingIcons();
            } else {
                this.resumeFallingIcons();
            }
        });
    }

    pauseFallingIcons() {
        this.isFallingIconsPaused = true;

        if (this.fallingIconInterval) {
            clearInterval(this.fallingIconInterval);
            this.fallingIconInterval = null;
        }

        if (this.fallingIconTimeouts.length) {
            this.fallingIconTimeouts.forEach(id => clearTimeout(id));
            this.fallingIconTimeouts = [];
        }

        if (this.fallingIconsContainer) {
            this.fallingIconsContainer.innerHTML = '';
        }
    }

    resumeFallingIcons() {
        this.isFallingIconsPaused = false;

        if (!this.fallingIconsContainer) return;
        if (this.fallingIconInterval) return;

        this.fallingIconsContainer.innerHTML = '';

        this.fallingIconInterval = setInterval(() => this.createFallingIcon(), 800);

        for (let i = 0; i < 5; i++) {
            const id = setTimeout(() => this.createFallingIcon(), i * 200);
            this.fallingIconTimeouts.push(id);
        }
    }

    async loadIconsFromCache() {
        // 尝试从本地存储加载缓存的图标
        const cachedIcons = localStorage.getItem('appIconCache');
        const cacheTimestamp = localStorage.getItem('appIconCacheTimestamp');
        const cacheAge = cacheTimestamp ? Date.now() - parseInt(cacheTimestamp) : Infinity;
        
        // 如果缓存存在且未过期（7天）
        if (cachedIcons && cacheAge < 7 * 24 * 60 * 60 * 1000) {
            this.iconUrls = new Set(JSON.parse(cachedIcons));
            console.log('Loaded icons from cache');
        } else {
            // 重新加载图标
            await this.loadDefaultIcons();
        }
    }

    async loadDefaultIcons() {
        if (window.location.protocol.startsWith('http')) {
            try {
                const response = await fetch('/api/default-icons', {
                    headers: {
                        'Accept': 'application/json'
                    }
                });

                if (response.ok) {
                    const payload = await response.json();
                    if (Array.isArray(payload.icons) && payload.icons.length > 0) {
                        this.iconUrls = new Set(payload.icons);
                    }
                }
            } catch (error) {
                console.warn('Failed to load default icons from backend:', error);
            }
        }

        if (!this.iconUrls.size) {
            for (const appName of this.defaultApps) {
                try {
                    const data = await this.requestItunesJson(
                        `https://itunes.apple.com/search?term=${encodeURIComponent(appName)}&media=software&entity=software,iPadSoftware&limit=1&country=us`
                    );
                    if (data.results && data.results[0]) {
                        const iconUrl = data.results[0].artworkUrl512 || data.results[0].artworkUrl100;
                        if (iconUrl) {
                            this.iconUrls.add(iconUrl);
                        }
                    }
                } catch (_) {
                }
            }
        }

        // 保存到本地存储
        if (this.iconUrls.size > 0) {
            localStorage.setItem('appIconCache', JSON.stringify(Array.from(this.iconUrls)));
            localStorage.setItem('appIconCacheTimestamp', Date.now().toString());
        }
    }

    createFallingIcon() {
        if (this.isFallingIconsPaused || document.hidden) return;
        if (!this.iconUrls.size) return;

        const icon = document.createElement('img');
        icon.className = 'falling-icon';
        
        const iconUrlsArray = Array.from(this.iconUrls);
        icon.src = iconUrlsArray[Math.floor(Math.random() * iconUrlsArray.length)];
        
        const startX = Math.random() * (window.innerWidth - 80);  // 减去图标宽度，防止超出右边界
        const duration = 2 + Math.random() * 1;
        const rotation = Math.random() < 0.5 ? 
            `${180 + Math.random() * 180}deg` :  // 顺时针旋转 180-360 度
            `${-(180 + Math.random() * 180)}deg`;  // 逆时针旋转 180-360 度
        
        icon.style.left = `${startX}px`;
        icon.style.animationDuration = `${duration}s`;
        icon.style.setProperty('--rotation', rotation);  // 设置随机旋转角度
        
        this.fallingIconsContainer.appendChild(icon);
        
        icon.addEventListener('animationend', () => {
            icon.remove();
        });
    }

    // 清理过期缓存
    cleanCache() {
        if (this.cache.size > 50) { // 当缓存超过 50 条时清理
            const oldestKeys = Array.from(this.cache.keys()).slice(0, 20);
            oldestKeys.forEach(key => this.cache.delete(key));
        }
    }

    setupWelcomeTitle() {
        const title = document.createElement('h1');
        title.className = 'welcome-title';
        document.body.appendChild(title);
        this.welcomeTitle = title;

        // 修改显示文本
        const text = 'App Startup Icon Download';  // 确保这里的文本保持一致
        let index = 0;
        
        // 创建打字效果
        const typeWriter = () => {
            if (index < text.length) {
                title.textContent += text.charAt(index);
                index++;
                setTimeout(typeWriter, 100);
            }
        };
        
        // 开始打字效果
        setTimeout(typeWriter, 500);
    }

    // 当清空搜索结果时显示标题
    clearResults() {
        this.resultsContainer.innerHTML = '';
        document.body.classList.remove('has-results');
    }

    reloadWelcomeTitle() {
        // 移除旧的标题
        if (this.welcomeTitle) {
            this.welcomeTitle.remove();
        }
        
        // 重新创建并开始打字效果
        this.setupWelcomeTitle();
    }

    setupTwitterLink() {
        const twitterLink = document.createElement('a');
        twitterLink.href = 'https://x.com/ZhaoLegs';
        twitterLink.className = 'twitter-link';
        twitterLink.textContent = 'Twitter';
        twitterLink.target = '_blank';  // 在新标签页打开
        twitterLink.rel = 'noopener noreferrer';  // 安全属性
        document.body.appendChild(twitterLink);
    }
}

let appInstance = null;
document.addEventListener('DOMContentLoaded', () => {
    if (!appInstance) {
        appInstance = new AppStartupIconDownload();
        window.appStartupIconDownload = appInstance; // 用于调试
    }
}); 
