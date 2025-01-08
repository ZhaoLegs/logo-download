class AppIconCollection {
    constructor() {
        this.initializeElements();
        this.initializeEventListeners();
        this.setupLoading();
        this.setupToast();
        this.setupFallingIcons();
        this.animationInterval = null;
        this.searchInput.placeholder = 'Enter app name';  // 搜索框占位符
    }

    initializeElements() {
        this.searchInput = document.getElementById('searchInput');
        this.resultsContainer = document.getElementById('results');
    }

    initializeEventListeners() {
        // 监听输入框内容变化
        this.searchInput.addEventListener('input', () => {
            clearTimeout(this.searchTimeout);
            
            // 当输入框为空时清空结果
            if (!this.searchInput.value.trim()) {
                this.resultsContainer.innerHTML = '';
                return;
            }
            
            this.searchTimeout = setTimeout(() => this.performSearch(), 500);
        });

        // 监听输入框清空事件（比如点击清除按钮）
        this.searchInput.addEventListener('search', () => {
            if (!this.searchInput.value.trim()) {
                this.resultsContainer.innerHTML = '';
            }
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

    showToast(message = 'Search failed, please try again', duration = 3000) {
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
            this.showLoading();

            // 设置超时
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Request timeout')), 10000);
            });

            // 只请求中国区 App Store
            const fetchPromise = fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(searchTerm)}&entity=software&limit=50&country=cn`);

            // 使用 Promise.race 来处理超时
            const response = await Promise.race([fetchPromise, timeoutPromise]);
            const data = await response.json();

            this.hideLoading();

            if (data.results && data.results.length > 0) {
                // 优化图标 URL 处理
                const processedResults = data.results.map(app => ({
                    ...app,
                    artworkUrl512: app.artworkUrl512 || 
                        (app.artworkUrl100 ? app.artworkUrl100.replace('100x100', '512x512') : app.artworkUrl100)
                }));
                
                this.displayResults(processedResults);
            } else {
                this.resultsContainer.innerHTML = '<p>No results found</p>';
            }
        } catch (error) {
            console.error('Search error:', error);
            this.hideLoading();
            
            // 如果中国区搜索失败，尝试美国区
            try {
                const backupResponse = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(searchTerm)}&entity=software&limit=50&country=us`);
                
                if (backupResponse.ok) {
                    const backupData = await backupResponse.json();
                    if (backupData.results && backupData.results.length > 0) {
                        const processedResults = backupData.results.map(app => ({
                            ...app,
                            artworkUrl512: app.artworkUrl512 || 
                                (app.artworkUrl100 ? app.artworkUrl100.replace('100x100', '512x512') : app.artworkUrl100)
                        }));
                        this.displayResults(processedResults);
                        return;
                    }
                }
                this.showToast('Search failed, please try again');
            } catch (backupError) {
                console.error('Backup search error:', backupError);
                this.showToast('Search failed, please try again');
            }
        }
    }

    displayResults(results) {
        this.resultsContainer.innerHTML = results.map(app => `
            <div class="app-card">
                <img src="${app.artworkUrl512 || app.artworkUrl100}" 
                     alt="${app.trackName}" 
                     class="app-icon"
                     data-app-url="${app.trackViewUrl}"
                     style="cursor: pointer;">
                <h3 class="app-name">${app.trackName}</h3>
                <button class="download-btn" 
                        data-icon-url="${app.artworkUrl512 || app.artworkUrl100}"
                        data-app-name="${app.trackName}">
                    Download
                </button>
            </div>
        `).join('');

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
}

new AppIconCollection(); 