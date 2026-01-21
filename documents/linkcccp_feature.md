## 1. 项目整体架构简述

onedrive-cf-index-ng 是一个基于 Next.js 构建的 OneDrive 公共目录列表应用，可部署在 Cloudflare Pages 上运行。项目采用前后端分离的架构设计：

### 前端层

- **框架**: Next.js (React)
- **样式**: Tailwind CSS + 自定义 CSS (globals.css)
- **图标**: FontAwesome 图标库 (\_app.tsx)
- **页面入口**: index.tsx 和 [src/pages/[...path].tsx](src/pages/[...path].tsx)

### 后端层 (API Routes)

- **运行时**: Cloudflare Workers Edge Runtime
- **主 API**: index.ts - 核心文件/文件夹列表接口
- **辅助 API**:
  - raw.ts - 原始文件下载
  - thumbnail.ts - 缩略图获取
  - search.ts - 搜索功能
  - item.ts - 获取单个项目详情

### 配置层

- **站点配置**: site.config.js - 网站标题、共享目录、受保护路由等
- **API 配置**: api.config.js - OAuth 凭证、API 端点、缓存策略

### 数据存储

- **Token 存储**: Cloudflare KV (odAuthTokenStore.ts)
- **本地存储**: localStorage 用于布局偏好、受保护路由的访问令牌

---

## 2. 核心功能定位表

| 功能名称            | 涉及文件路径                                         | 核心逻辑简述                                                               |
| ------------------- | ---------------------------------------------------- | -------------------------------------------------------------------------- |
| **文件/文件夹列表** | FileListing.tsx                                      | 主要列表组件，根据 API 响应渲染文件夹或文件，支持分页加载                  |
| **图书竖版网格布局** | Linkcccp_BookGridLayout.tsx                          | 以竖版封面形式展示书籍，包含封面、书名、作者信息                           |
| **列表布局**        | FolderListLayout.tsx                                 | 以列表形式展示文件夹内容，显示文件名、修改时间、大小                       |
| **布局切换**        | SwitchLayout.tsx                                     | 在网格和列表布局之间切换，偏好存储在 localStorage                          |
| **文件预览**        | previews                                             | 各类文件预览组件，包括图片、视频、音频、PDF、Office、代码、Markdown 等     |
| **视频预览**        | VideoPreview.tsx                                     | 使用 Plyr 播放器，支持字幕加载、多播放器链接                               |
| **代码预览**        | CodePreview.tsx                                      | 使用 react-syntax-highlighter 进行语法高亮                                 |
| **Markdown 预览**   | MarkdownPreview.tsx                                  | 支持 GFM、数学公式 (KaTeX)、代码块高亮                                     |
| **PDF 预览**        | PDFPreview.tsx                                       | 使用 Mozilla PDF.js 在线查看器                                             |
| **Office 预览**     | OfficePreview.tsx                                    | 使用 preview-office-docs 组件预览 Office 文档                              |
| **默认预览**        | DefaultPreview.tsx                                   | 显示文件元信息（大小、修改时间、MIME 类型、哈希值）                        |
| **文件下载**        | DownloadBtnGtoup.tsx                                 | 提供直接下载、复制链接、自定义链接等功能                                   |
| **多文件下载**      | MultiFileDownloader.tsx                              | 支持批量选择文件打包下载为 ZIP                                             |
| **文件夹下载**      | MultiFileDownloader.tsx 中的 `traverseFolder`        | 递归遍历文件夹并打包下载                                                   |
| **搜索功能**        | SearchModal.tsx                                      | 模态框搜索界面，使用防抖处理搜索请求                                       |
| **面包屑导航**      | Breadcrumb.tsx                                       | 显示当前路径，支持点击跳转                                                 |
| **导航栏**          | Navbar.tsx                                           | 顶部导航，包含搜索、外部链接、登出功能                                     |
| **受保护路由**      | Auth.tsx, protectedRouteHandler.ts                   | 密码保护文件夹，需要输入密码才能访问                                       |
| **自定义嵌入链接**  | CustomEmbedLinkMenu.tsx                              | 生成自定义文件名的直链                                                     |
| **OAuth 认证流程**  | onedrive-oauth                                       | 三步 OAuth 认证：检查配置 → 获取授权码 → 存储令牌                          |
| **Token 管理**      | odAuthTokenStore.ts, index.ts                        | 自动刷新过期的 access_token                                                |
| **文件类型判断**    | getPreviewType.ts, getFileIcon.ts                    | 根据文件扩展名判断预览类型和图标                                           |
| **文件详情格式化**  | fileDetails.ts                                       | 文件大小人性化显示、日期格式化                                             |
| **API 路径编码**    | index.ts 中的 `encodePath`                           | 将相对路径转换为 OneDrive API 路径格式                                     |
| **认证路由检查**    | index.ts 中的 `checkAuthRoute`                       | 检查路径是否需要密码保护                                                   |
| **本地开发持久化**  | Linkcccp_dev-start.js, Linkcccp_local-token-store.ts | 支持将 OAuth token 持久化到本地文件，解决开发环境重启需重复登录的问题      |
| **图书元数据筛选**  | Linkcccp_bookIndex.ts, Linkcccp_Sidebar.tsx          | Calibre 风格的图书筛选，支持作者/标签/丛书/语言/出版商/格式多维度 AND 筛选 |

---

## 3. 常见修改点指南

### 3.1 修改 UI 样式

| 修改目标      | 文件位置                                               | 说明                          |
| ------------- | ------------------------------------------------------ | ----------------------------- |
| 全局样式      | globals.css                                            | Tailwind 基础配置和自定义样式 |
| Tailwind 配置 | tailwind.config.js                                     | 扩展颜色、字体、间距等        |
| 字体配置      | site.config.js 中的 `googleFontSans`, `googleFontMono` | 修改网站使用的字体            |
| 网站标题/图标 | site.config.js 中的 `title`, `icon`                    | 修改导航栏显示的标题和图标    |
| 页脚内容      | site.config.js 中的 `footer`                           | 自定义页脚 HTML               |
| 导航栏链接    | site.config.js 中的 `links`                            | 添加/修改导航栏外部链接       |
| 布局组件样式  | FolderGridLayout.tsx, FolderListLayout.tsx             | 修改文件列表的展示样式        |

### 3.2 修改下载与缓存优化 (Linkcccp_Optimization)

| 修改目标     | 文件位置                | 说明                                                                  |
| ------------ | ----------------------- | --------------------------------------------------------------------- |
| 下载按钮组   | DownloadBtnGtoup.tsx    | 修改下载按钮的样式和行为                                              |
| 多文件下载   | MultiFileDownloader.tsx | 修改批量下载的 ZIP 打包逻辑                                           |
| 原始文件 API | raw.ts                  | **智能分流**：90MB 以下走 Cloudflare 代理+CDN 缓存；以上直连 OneDrive |
| 下载链接格式 | CustomEmbedLinkMenu.tsx | 自定义直链的生成规则                                                  |

### 3.3 调整 API 配置

| 修改目标   | 文件位置                                                | 说明                                                         |
| ---------- | ------------------------------------------------------- | ------------------------------------------------------------ |
| OAuth 凭证 | api.config.js 中的 `clientId`, `obfuscatedClientSecret` | 使用自己的 Azure AD 应用凭证                                 |
| API 端点   | api.config.js 中的 `authApi`, `driveApi`                | 世纪互联用户需要修改                                         |
| 缓存策略   | api.config.js 中的 `cacheControlHeader`                 | **异步刷新**：配置 `stale-while-revalidate` 兼顾速度与新鲜度 |
| 共享目录   | site.config.js 中的 `baseDirectory`                     | 设置要公开的 OneDrive 文件夹                                 |
| 分页数量   | site.config.js 中的 `maxItems`                          | 每页显示的最大项目数（上限 200）                             |
| 受保护路由 | site.config.js 中的 `protectedRoutes`                   | 添加需要密码保护的文件夹路径                                 |

### 3.4 添加/修改文件预览类型

| 修改目标     | 文件位置                      | 说明                               |
| ------------ | ----------------------------- | ---------------------------------- |
| 预览类型映射 | getPreviewType.ts             | 添加新的文件扩展名到预览类型的映射 |
| 文件图标     | getFileIcon.ts                | 添加新的文件类型图标               |
| 预览组件     | previews                      | 创建新的预览组件                   |
| 预览路由     | FileListing.tsx 第 375-425 行 | 在 switch 语句中添加新的预览类型   |

### 3.5 修改认证流程

| 修改目标   | 文件位置                 | 说明                              |
| ---------- | ------------------------ | --------------------------------- |
| OAuth 处理 | oAuthHandler.ts          | 修改 OAuth URL 生成、令牌请求逻辑 |
| Token 存储 | odAuthTokenStore.ts      | 修改 KV 存储键名或过期策略        |
| 密码验证   | protectedRouteHandler.ts | 修改密码哈希和验证逻辑            |
| OAuth 页面 | onedrive-oauth           | 自定义认证流程的 UI               |

---

## 4. 注意事项

### ⚠️ 核心逻辑文件（修改需谨慎）

| 文件路径                 | 风险等级 | 说明                                                                 |
| ------------------------ | -------- | -------------------------------------------------------------------- |
| index.ts                 | 🔴 高    | 核心 API 入口，包含路径编码、Token 刷新、认证检查、OneDrive API 调用 |
| odAuthTokenStore.ts      | 🔴 高    | Token 存储逻辑，修改不当会导致认证失败                               |
| oAuthHandler.ts          | 🔴 高    | OAuth 流程处理，包含敏感的 token 混淆逻辑                            |
| raw.ts                   | 🟠 中    | 原始文件下载 API，修改会影响所有下载功能                             |
| protectedRouteHandler.ts | 🟠 中    | 受保护路由的密码验证逻辑                                             |
| api.config.js            | 🟠 中    | API 配置，错误配置会导致无法连接 OneDrive                            |
| FileListing.tsx          | 🟡 低-中 | 核心列表组件，代码复杂，涉及多种状态管理                             |

### 📝 修改建议

1. **备份优先**: 修改核心文件前务必备份或使用版本控制
2. **环境变量**: 敏感配置（如 `userPrincipalName`）建议使用环境变量而非硬编码
3. **类型安全**: 项目使用 TypeScript，注意 index.d.ts 中的类型定义
4. **Edge Runtime 限制**: API 路由运行在 Cloudflare Workers 上，某些 Node.js API 不可用
5. **CORS 配置**: 修改 API 时注意 raw.ts 中的 CORS 头设置
6. **缓存清理**: 修改配置后可能需要清除 Cloudflare 缓存才能生效

### 🔒 安全相关

- `obfuscatedClientSecret` 是经过 AES 加密的，直接修改可能导致认证失败
- `.password` 文件存储在 OneDrive 对应文件夹中，内容为明文密码的哈希值
- 受保护路由的访问令牌存储在浏览器 localStorage 中

---

### 🛠️ 自定义开发规范

**本项目所有非官方添加的功能、组件和预览类型，统一使用 `Linkcccp_` 作为前缀。**

#### 当前已添加的自定义功能：

- **功能名**：CBZ 漫画长条预览

  - **涉及文件**：`src/components/previews/Linkcccp_CBZPreview.tsx`
  - **预览类型标识**：`Linkcccp_cbz`

- **功能名**：全站通用离线缓存系统

  - **涉及文件**：`src/utils/Linkcccp_UniversalCache.ts`
  - **作用**：为 PDF、EPUB、CBZ 提供永久性本地数据库存储。

- **功能名**：本地开发 Token 持久化 (Dev Persistence)

  - **涉及文件**：`Linkcccp_dev-start.js` (启动脚本)、`src/pages/api/Linkcccp_local-token-store.ts` (读写接口)
  - **作用**：让 Next.js 环境支持本地文件存储 Token，解决“关闭终端/重启服务需重新登录”的痛点。

- **功能名**：图书元数据筛选系统 (Library Filter)
  - **涉及文件**：
    - `src/pages/api/Linkcccp_bookIndex.ts` (元数据 API)
    - `src/components/Linkcccp_Sidebar.tsx` (筛选侧边栏)
    - `index_metadata.py` (本地元数据生成脚本)
  - **作用**：类似 Calibre 的图书筛选功能，支持按作者、标签、丛书、语言、出版商、格式进行 AND 逻辑筛选。
  - **使用方式**：
    1. 在本地运行 `python index_metadata.py` 选择书库目录生成 `index.json`
    2. 将 `index.json` 同步到 OneDrive 的 `baseDirectory` 根目录
    3. 网页端点击「筛选」按钮即可使用
- **功能名**：渐进式 Web 应用 (PWA)
  - **核心逻辑**：基于 `next-pwa` 插件。
  - **注意**：`site.webmanifest` 遵循 Web 行业标准命名，不添加前缀以确保浏览器最高兼容性。

> 这样可以确保以后无论是开发者还是 AI 助手，在维护本项目时都能遵循统一的自定义扩展命名规范。

---

### 🎯 技术特性

#### ① 极致流畅持久化模式 (Linkcccp_UniversalCache)

- **本地零流量重载**：基于 IndexedDB 存储，将 PDF、EPUB、CBZ 等大文件缓存至本地。再次访问相同文件时直接从本地读取，**不消耗网盘流量**。
- **智能增量更新**：自动校验 `lastModified` 时间戳。仅当文件更新时才重新下载，平衡“新鲜度”与“省流量”。
- **全量内存加载**：解压后的漫画图片永久保留在当前会话中，支持前后极速翻转、无任何二次加载。
- **整流式预载进度条**：通过流式 API 实时反馈下载百分比，让加载过程透明可控。

#### ② PWA 全栈离线能力

- **离线访问**：支持断网状态下加载网站外壳、基础图标及已缓存的文件列表。
- **App 化体验**：补全了 `site.webmanifest` 规范，支持安装到桌面并实现沉浸式全屏浏览。

#### ③ 工业级渲染优化

- **无缝衔接布局**：漫画图片使用 `block` 布局，消除空隙，实现“长条漫”丝滑体验。
- **渲染隔离 (Memo)**：确保单页加载不会引发整个列表的重绘。
- **异步解码**：开启 `decoding="async"`，彻底消除快速滚动时的白屏块。

---

### 📋 维护记录：已修复的坑

| 坑位               | 问题描述                                        | 解决方案                                                     |
| ------------------ | ----------------------------------------------- | ------------------------------------------------------------ | --- | -------------------------------- |
| **TS2769 (EPUB)**  | ReactReader 接收 null 作为 url 导致构建失败     | 增加 `loading                                                |     | !blobUrl` 前置判断，确保类型安全 |
| **TS2345 (Blob)**  | Uint8Array 缓冲区类型不匹配 (SharedArrayBuffer) | 将下载块类型定义为 `any[]` 以绕过严格校验                    |
| **PWA 无效**       | Manifest 缺少 `start_url` 导致浏览器不识别      | 补全 `public/site.webmanifest` 中的关键入口配置              |
| **内存泄漏**       | 大量 Blob URL 堆积导致系统卡顿                  | 在 `useEffect` 清理函数中增加 `URL.revokeObjectURL`          |
| **Range 请求报错** | 302 重定向导致 Range 头丢失                     | 先进行探测请求获取最终 URL 再传给下载器                      |
| **重复登录**       | 开发环境关闭终端后需重新登录                    | 开发 `Linkcccp_dev-start.js` 持久化方案，实现 Token 自动加载 |

## 6. 文件索引生成功能 (Linkcccp_generateIndex)

### 🎯 功能概述

为解决 OneDrive 原生搜索对中文支持不佳的问题，本项目实现了自动生成 `index.md` 文件的功能。该功能会递归遍历您在 `site.config.js` 中设置的**网站根目录**（`baseDirectory`），生成包含完整目录树的清单，支持浏览器原生快速搜索 (Ctrl+F)。

### 📚 详细文档

关于该功能的详细技术逻辑（递归、分页、编码、转义）、Edge Runtime 兼容性修复、安全配置及测试指南，请参阅专门的综合文档：

👉 **[OneDrive 索引自动生成功能开发维护手册](Linkcccp_feature_index_generation.md)**

---

## 7. CDN 性能加速与全自动缓存策略 (Linkcccp_CDN_Optimization)

### 🎯 方案概述

为了应对高并发访问（如多人同时查看 CBZ 漫画）并防止 OneDrive API 限速，本项目实施了基于 Cloudflare Workers 的智能代理与缓存方案。

### ⚙️ 技术实现

#### ① 智能分流 (Smart Routing)

- **文件限制处理**：由于 Cloudflare Workers 免费版对单个响应大小及处理时间有限制（约 100MB），逻辑设定为：
  - **大小 < 90MB**：通过 Worker 代理。
  - **大小 > 90MB**：直接 302 重定向至 OneDrive 官方下载链接。
- **Range 穿透**：代理逻辑完美转发 `Range` 请求头，确保 CBZ 预览器能实现“按需取图”，无需下载整个压缩包。

#### ② 异步刷新缓存 (Stale-While-Revalidate)

- **配置参数**：`max-age=0, s-maxage=60, stale-while-revalidate=604800`
- **逻辑模型**：
  - **1 秒内**：直接由 CDN 命中。
  - **1 分钟后**：首个访问者触发后台更新检测，但依然先看到旧缓存（极速响应）。
  - **7 天内**：如果没有更新，缓存将一直保持有效。
- **优势**：内容更新后（如 OneDrive 换图）最快 60 秒内开始自动同步，且完全不占用网盘查询次数。

### 📝 维护重点

- 修改 `config/api.config.js` 即可调整全局缓存强度。
- 修改 `src/pages/api/raw.ts` 即可调整“走 CDN”与“走直连”的阈值（当前为 90MB）。

---

## 8. 常见问题排查 (待补充)
