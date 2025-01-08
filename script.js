class AppIconCollection {
    constructor() {
        this.initializeElements();
        this.initializeEventListeners();
        this.setupLoading();
        this.setupToast();
        this.setupFallingIcons();
        this.animationInterval = null;
    }

    initializeElements() {
        this.searchInput = document.getElementById('searchInput');
        this.resultsContainer = document.getElementById('results');
    }

    initializeEventListeners() {
        // 搜索功能
        this.searchInput.addEventListener('input', () => {
            clearTimeout(this.searchTimeout);
            this.searchTimeout = setTimeout(() => this.performSearch(), 500);
        });
    }

    setupLoading() {
        this.loading = document.createElement('div');
        this.loading.className = 'loading';
        this.resultsContainer.appendChild(this.loading);
    }

    showLoading() {
        this.loading.classList.add('active');
    }

    hideLoading() {
        this.loading.classList.remove('active');
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

    async performSearch() {
        const searchTerm = this.searchInput.value.trim();
        if (!searchTerm) return;

        try {
            // 显示加载状态
            this.showLoading();

            // 添加错误处理和重试逻辑
            const response = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(searchTerm)}&entity=software&limit=50&country=cn`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                },
                mode: 'cors'  // 明确指定跨域模式
            });

            if (!response.ok) {
                throw new Error('Network response was not ok');
            }

            const data = await response.json();
            
            // 隐藏加载状态
            this.hideLoading();

            if (data.results && data.results.length > 0) {
                this.displayResults(data.results);
            } else {
                this.resultsContainer.innerHTML = '<p>No results found</p>';
            }
        } catch (error) {
            console.error('Search error:', error);
            this.hideLoading();
            this.showToast('搜索失败，请重试');
            
            // 如果是网络错误，可以尝试使用备用 API
            try {
                const backupResponse = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(searchTerm)}&entity=software&limit=50&country=us`, {
                    method: 'GET',
                    headers: {
                        'Accept': 'application/json',
                    },
                    mode: 'cors'
                });
                
                if (backupResponse.ok) {
                    const backupData = await backupResponse.json();
                    if (backupData.results && backupData.results.length > 0) {
                        this.displayResults(backupData.results);
                        return;
                    }
                }
            } catch (backupError) {
                console.error('Backup search error:', backupError);
            }
        }
    }

    displayResults(apps) {
        this.resultsContainer.innerHTML = '';
        
        if (!apps || !apps.length) {
            this.resultsContainer.innerHTML = '<p>No results found</p>';
            return;
        }

        apps.forEach(app => {
            const card = document.createElement('div');
            card.className = 'app-card';
            
            const iconUrl = app.artworkUrl512 || app.artworkUrl100;
            
            card.innerHTML = `
                <img src="${iconUrl}" alt="${app.trackName}" class="app-icon">
                <div class="app-name">${app.trackName}</div>
                <button class="download-btn">Download</button>
            `;

            card.querySelector('.download-btn').addEventListener('click', () => {
                this.downloadIcon(iconUrl, app.trackName);
            });

            this.resultsContainer.appendChild(card);
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
            
            this.showToast('图标下载成功');
        } catch (error) {
            console.error('Download error:', error);
            this.showToast('下载失败，请重试');
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
}

new AppIconCollection(); 