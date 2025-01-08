class AppIconCollection {
    constructor() {
        this.initializeElements();
        this.setupToast();
        this.initializeEventListeners();
        
        // 缓存常用变量
        this.defaultApps = [
            'wechat', 'qq', 'alipay', 'taobao', 
            'bilibili', 'weibo', 'facebook', 
            'instagram', 'twitter', 'tiktok'
        ];
        
        // 防抖延迟时间
        this.SEARCH_DELAY = 500;
        
        // 初始化完成后加载默认应用
        this.loadDefaultApps();
    }

    initializeElements() {
        this.searchInput = document.getElementById('searchInput');
        this.resultsContainer = document.getElementById('results');
        
        // 创建 toast 元素
        this.toast = document.createElement('div');
        this.toast.className = 'toast';
        document.body.appendChild(this.toast);
    }

    setupToast() {
        this.showToast = (message, duration = 3000) => {
            this.toast.textContent = message;
            this.toast.classList.add('show');
            setTimeout(() => {
                this.toast.classList.remove('show');
            }, duration);
        };
    }

    initializeEventListeners() {
        // 使用防抖优化搜索
        this.searchInput.addEventListener('input', this.debounce(() => {
            const term = this.searchInput.value.trim();
            term ? this.performSearch() : this.loadDefaultApps();
        }, this.SEARCH_DELAY));
    }

    // 防抖函数
    debounce(func, wait) {
        let timeout;
        return (...args) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }

    async searchAppStore(term, country) {
        try {
            // 添加 JSONP 回调参数
            const url = `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&entity=software&limit=50&country=${country}&callback=?`;
            
            // 使用 JSONP 方式请求
            return new Promise((resolve, reject) => {
                $.ajax({
                    url: url,
                    dataType: 'jsonp',
                    success: (data) => {
                        resolve(data.results);
                    },
                    error: (error) => {
                        console.error(`${country} store search error:`, error);
                        reject(error);
                    }
                });
            });
        } catch (error) {
            console.error(`${country} store search error:`, error);
            return [];
        }
    }

    mergeAndDeduplicateResults(cnResults, usResults) {
        const uniqueApps = new Map();
        
        // 使用 Map 优化去重过程
        [...cnResults, ...usResults].forEach(app => {
            if (!uniqueApps.has(app.trackId)) {
                uniqueApps.set(app.trackId, app);
            }
        });
        
        return Array.from(uniqueApps.values());
    }

    async performSearch() {
        const term = this.searchInput.value.trim();
        if (!term) {
            return this.loadDefaultApps();
        }

        try {
            const [cnResults, usResults] = await Promise.all([
                this.searchAppStore(term, 'cn'),
                this.searchAppStore(term, 'us')
            ]);

            const mergedResults = this.mergeAndDeduplicateResults(cnResults, usResults);
            
            // 如果没有搜索结果，直接加载默认应用
            if (!mergedResults.length) {
                return this.loadDefaultApps();
            }

            this.displayResults(mergedResults);
        } catch (error) {
            console.error('Search error:', error);
            this.showToast('搜索失败，请重试');
        }
    }

    async loadDefaultApps() {
        try {
            const randomTerm = this.defaultApps[Math.floor(Math.random() * this.defaultApps.length)];
            const [cnResults, usResults] = await Promise.all([
                this.searchAppStore(randomTerm, 'cn'),
                this.searchAppStore(randomTerm, 'us')
            ]);

            const allResults = this.mergeAndDeduplicateResults(cnResults, usResults);
            if (allResults.length > 0) {
                this.displayResults(allResults);
            } else {
                console.error('No results found for default apps');
                this.showToast('加载推荐应用失败，请刷新重试');
            }
        } catch (error) {
            console.error('Default apps loading error:', error);
            this.showToast('加载推荐应用失败，请刷新重试');
        }
    }

    displayResults(apps) {
        const fragment = document.createDocumentFragment();
        apps.forEach(app => {
            const card = document.createElement('div');
            card.className = 'app-card';
            const iconUrl = app.artworkUrl512 || app.artworkUrl100?.replace('100x100', '512x512') || app.artworkUrl100;
            
            card.innerHTML = `
                <img src="${iconUrl}" alt="${app.trackName}" class="app-icon">
                <div class="app-name">${app.trackName}</div>
                <button class="download-btn">Download</button>
            `;

            card.querySelector('.download-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                this.downloadIcon(iconUrl, app.trackName);
            });

            fragment.appendChild(card);
        });

        this.resultsContainer.innerHTML = '';
        this.resultsContainer.appendChild(fragment);
    }

    downloadIcon(url, appName) {
        fetch(url)
            .then(response => response.blob())
            .then(blob => {
                const blobUrl = window.URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = blobUrl;
                link.download = `${appName.replace(/\s+/g, '-').toLowerCase()}-icon.png`;
                link.style.display = 'none';
                document.body.appendChild(link);
                link.click();
                
                // 清理
                setTimeout(() => {
                    document.body.removeChild(link);
                    window.URL.revokeObjectURL(blobUrl);
                }, 100);
            })
            .catch(error => {
                console.error('Download error:', error);
                this.showToast('下载失败，请重试');
            });
    }
}

// 确保 DOM 加载完成后再初始化
document.addEventListener('DOMContentLoaded', () => new AppIconCollection()); 