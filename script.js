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
        
        // 创建 loading 元素
        const loading = document.createElement('div');
        loading.className = 'loading';
        
        // 组装
        loadingContainer.appendChild(loading);
        document.body.appendChild(loadingContainer);
        this.loadingElement = loadingContainer;
    }

    showLoading() {
        if (this.loadingElement) {
            this.loadingElement.style.display = 'block';
        }
    }

    hideLoading() {
        if (this.loadingElement) {
            this.loadingElement.style.display = 'none';
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
            '小红书': 'RED',
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

    async performSearch() {
        let searchTerm = this.searchInput.value.trim();
        if (!searchTerm) return;

        try {
            this.showLoading();

            // 检查缓存
            if (this.cache.has(searchTerm)) {
                this.hideLoading();
                this.displayResults(this.cache.get(searchTerm));
                return;
            }

            // 转换中文应用名称
            const searchQuery = this.chineseAppMap[searchTerm] || searchTerm;
            let results = null;

            // 判断搜索语言，决定搜索顺序
            const isChineseSearch = this.isChineseQuery(searchTerm);

            if (isChineseSearch) {
                // 中文搜索：先搜中国区，再搜美国区
                results = await this.searchInRegion(searchQuery, 'cn');
                if (!results || results.length === 0) {
                    results = await this.searchInRegion(searchQuery, 'us');
                }
            } else {
                // 英文搜索：先搜美国区，再搜中国区
                results = await this.searchInRegion(searchQuery, 'us');
                if (!results || results.length === 0) {
                    results = await this.searchInRegion(searchQuery, 'cn');
                }
            }

            // 如果映射后的搜索没有结果，尝试原始搜索词
            if (!results && searchQuery !== searchTerm) {
                if (isChineseSearch) {
                    results = await this.searchInRegion(searchTerm, 'cn');
                    if (!results || results.length === 0) {
                        results = await this.searchInRegion(searchTerm, 'us');
                    }
                } else {
                    results = await this.searchInRegion(searchTerm, 'us');
                    if (!results || results.length === 0) {
                        results = await this.searchInRegion(searchTerm, 'cn');
                    }
                }
            }

            if (results && results.length > 0) {
                this.cache.set(searchTerm, results);
                this.hideLoading();
                this.displayResults(results);
            } else {
                this.hideLoading();
                this.resultsContainer.innerHTML = '';
                this.showToast('No results found');
            }

        } catch (error) {
            console.error('Search error:', error);
            this.hideLoading();
            this.showToast('Search failed, please try again');
        }
    }

    async searchInRegion(term, region) {
        try {
            const response = await fetch(
                `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&entity=software&limit=50&country=${region}`,
                {
                    headers: {
                        'Accept': 'application/json',
                        'Content-Type': 'application/json',
                        'Cache-Control': 'no-cache'
                    }
                }
            );

            if (!response.ok) return null;

            const data = await response.json();
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
        document.body.classList.add('has-results');
        
        // 优化显示结果
        this.resultsContainer.innerHTML = results
            // 确保应用名称和图标都存在
            .filter(app => app.trackName && (app.artworkUrl512 || app.artworkUrl100))
            .map(app => {
                // 处理应用名称，移除多余空格和特殊字符
                const cleanName = app.trackName.trim().replace(/\s+/g, ' ');
                
                return `
                    <div class="app-card">
                        <img src="${app.artworkUrl512 || app.artworkUrl100}" 
                             alt="${cleanName}" 
                             class="app-icon"
                             data-app-url="${app.trackViewUrl}"
                             style="cursor: pointer;">
                        <h3 class="app-name">${cleanName}</h3>
                        <button class="download-btn" 
                                data-icon-url="${app.artworkUrl512 || app.artworkUrl100}"
                                data-app-name="${cleanName}">
                            Download
                        </button>
                    </div>
                `;
            })
            .join('');

        // 图标点击事件
        this.resultsContainer.querySelectorAll('.app-icon').forEach(icon => {
            icon.addEventListener('click', (e) => {
                const appUrl = e.target.dataset.appUrl;
                if (appUrl) {
                    window.open(appUrl, '_blank');
                }
            });
        });

        // 下载按钮点击事件
        this.resultsContainer.querySelectorAll('.download-btn').forEach(button => {
            button.addEventListener('click', async (e) => {
                const iconUrl = e.target.dataset.iconUrl;
                const appName = e.target.dataset.appName;
                
                try {
                    const response = await fetch(iconUrl);
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
                    this.showToast('Icon downloaded successfully');
                } catch (error) {
                    console.error('Download error:', error);
                    this.showToast('Download failed, please try again');
                }
            });
        });
    }

    async downloadIcon(url, appName) {
        try {
            const response = await fetch(url);
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
        setInterval(() => this.createFallingIcon(), 800);
        
        // 初始时立即创建多个图标
        for (let i = 0; i < 5; i++) {
            setTimeout(() => this.createFallingIcon(), i * 200);
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
        console.log('Loading fresh icons');
        for (const appName of this.defaultApps) {
            try {
                const response = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(appName)}&entity=software&limit=1&country=us`);
                const data = await response.json();
                if (data.results && data.results[0]) {
                    // 优先使用高清图标
                    const iconUrl = data.results[0].artworkUrl512 || data.results[0].artworkUrl100;
                    this.iconUrls.add(iconUrl);
                }
            } catch (error) {
                console.error('Error loading default icon:', error);
            }
        }

        // 保存到本地存储
        if (this.iconUrls.size > 0) {
            localStorage.setItem('appIconCache', JSON.stringify(Array.from(this.iconUrls)));
            localStorage.setItem('appIconCacheTimestamp', Date.now().toString());
        }
    }

    createFallingIcon() {
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