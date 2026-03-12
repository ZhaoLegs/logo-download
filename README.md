# logo-download

一个用于搜索并下载 App 启动图标的小工具，优先返回 App Store 图标，在苹果接口命中不足时会自动补抓 Google Play 结果。

在线仓库: [ZhaoLegs/logo-download](https://github.com/ZhaoLegs/logo-download)

## 功能

- 支持英文、中文、App ID、App Store 链接搜索
- 优先走后端 `/api/search`，避免浏览器直接跨域或被限流
- App Store 结果不足时，自动使用 `Crawlee` 补抓 Google Play
- 首页背景图标由后端预加载，不再在前端直接请求 iTunes
- 图标下载走 `/api/icon` 代理，减少跨域失败
- 兼容两种启动方式:
  - `npm start` 启动 Node 服务，默认端口 `3000`
  - `python3 server.py` 启动兼容代理，默认端口 `5173`，会自动拉起 Node 后端

## 技术栈

- 前端: 原生 HTML / CSS / JavaScript
- 后端: Node.js + Express
- 抓取: Crawlee + Cheerio
- 兼容代理: Python 标准库 HTTP Server

## 本地运行

### 方式一: Node

```bash
npm install
npm start
```

打开 [http://localhost:3000](http://localhost:3000)

### 方式二: Python 兼容入口

```bash
npm install
python3 server.py
```

打开 [http://localhost:5173](http://localhost:5173)

## API

### `GET /api/search?q=关键词`

搜索应用并返回排序后的结果。

示例:

```bash
curl "http://localhost:3000/api/search?q=mixplorer"
```

### `GET /api/default-icons`

返回首页背景漂浮图标池。

### `GET /api/icon?url=...`

代理下载图标资源，仅允许 Google Play 和 Apple 图标域名。

## 目录说明

```text
.
├── index.html      # 页面入口
├── script.js       # 前端搜索、渲染、下载逻辑
├── style.css       # 页面样式
├── server.js       # Node/Express 搜索服务
├── server.py       # Python 兼容代理入口
└── package.json    # 依赖与启动脚本
```

## 已验证场景

- `notion` 可以正常返回 App Store 结果
- `mixplorer` 可以通过 Google Play 补抓命中
- `小红书` 可以正常搜到 `rednote` / 小红书相关结果

## 注意事项

- iTunes 官方接口偶发会返回 `403`，当前版本会自动降级并尽量保持搜索可用
- 本项目默认只暴露页面、脚本、样式和 API，不直接公开整个项目目录

## License

MIT
