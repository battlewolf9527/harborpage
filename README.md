# HarborPage - 个人导航页面

一个基于 React + Vite + Cloudflare Workers 构建的现代化个人导航页面，支持网站图标管理、文件夹分类、搜索引擎切换、天气显示、待办事项、笔记等功能。

## ✨ 功能特性

### 🌐 网站图标管理
- 添加、修改、删除网站快捷方式
- 自动获取网站图标（Favicon），使用 Google favicon 服务
- 支持自定义图标地址和图标上传
- 图标缓存到 Cloudflare R2（可选）
- 拖拽排序和移动图标
- 右键菜单快速操作

### 📁 文件夹功能
- 拖拽图标到另一个图标上创建文件夹
- 文件夹图标显示前4个网站的图标（田字形排列）
- 支持文件夹名称修改
- 拖拽图标移入/移出文件夹
- 空文件夹显示📁图标

### 🔍 搜索功能
- 多搜索引擎支持（Google、百度、必应等）
- 自定义添加搜索引擎
- 搜索引擎图标自动获取
- 快速切换搜索引擎
- 默认搜索引擎同步到云端存储

### 🌤️ 天气显示
- 实时天气信息显示
- 支持浏览器定位和IP定位
- 和风天气API支持
- 显示当前温度和天气状态
- 显示时间和日期（点击日期切换农历）

### ✅ 待办事项
- 添加、编辑、删除待办事项
- 标记完成状态
- 数据持久化存储到 Cloudflare KV
- 未完成数量徽章显示

### 📝 笔记功能
- 创建和管理笔记
- 支持标题和内容
- 创建时间记录

### 🎨 壁纸管理
- Bing每日壁纸
- 随机Bing壁纸
- 本地图片上传
- 纯色背景
- 模糊度和遮罩浓度调节
- 壁纸代理支持（白名单域名限制）

### 🔐 安全认证
- JWT 登录认证
- 密码 SHA-256 加密传输
- 7天 Token 有效期
- 自动登出处理
- 敏感信息存储在 Cloudflare Secrets

### ⚙️ 设置面板
- 图标行列数设置
- 壁纸设置
- 搜索引擎管理
- 待办事项管理
- 笔记管理
- 预设站点导入

## 🛠️ 技术栈

### 前端
- **React 19** - 用户界面库
- **TypeScript** - 类型安全
- **Vite 7** - 构建工具
- **Zustand 5** - 状态管理
- **lunisolar 2** - 农历日期转换
- **qweather-icons 1** - 天气图标
- **Crypto-JS** - SHA-256 加密

### 后端
- **Cloudflare Workers** - 无服务器计算
- **Cloudflare KV** - 数据存储
- **Cloudflare R2** - 图标文件存储
- **jose 6** - JWT 认证
- **Wrangler 4** - Cloudflare CLI 工具

## 📦 安装和部署

### 前置要求
- Node.js 18+
- Cloudflare 账号
- Wrangler CLI 4+

### 本地开发

```bash
# 安装依赖
npm install

# 复制环境变量配置
cp .dev.vars.sample .dev.vars
cp wrangler.sample.jsonc wrangler.jsonc

# 填写 .dev.vars 中的敏感信息
# 填写 wrangler.jsonc 中的 KV 和 R2 资源 ID

# 启动开发服务器（带热重载）
npm run dev
```

### 部署到 Cloudflare

```bash
# 构建项目
npm run build

# 部署到 Cloudflare Workers
npm run deploy
```

### 配置步骤

1. **创建 KV 命名空间**
   ```bash
   wrangler kv:namespace create USER_DATA
   ```

2. **创建 R2 存储桶（可选，用于图标缓存）**
   ```bash
   wrangler r2:bucket create harbor
   ```

3. **设置敏感环境变量（生产环境）**
   ```bash
   wrangler secret put PASSWORD
   wrangler secret put JWT_SECRET
   wrangler secret put WEATHER_API_KEY
   wrangler secret put WEATHER_API_HOST
   ```

4. **配置 wrangler.jsonc**
   - 将 KV 命名空间 ID 填入 `kv_namespaces[0].id`
   - 将 R2 存储桶名称填入 `r2_buckets[0].bucket_name`
   - 配置 `R2_URL`（启用 R2 CDN 时需要）

### 环境变量说明

| 变量名 | 说明 | 是否必需 |
|--------|------|----------|
| `PASSWORD` | 登录密码 | 是 |
| `JWT_SECRET` | JWT 签名密钥 | 是 |
| `WEATHER_API_KEY` | 和风天气 API 密钥 | 否 |
| `WEATHER_API_HOST` | 和风天气 API 主机地址 | 否 |
| `R2_URL` | R2 存储访问地址（启用 R2 CDN 时需要） | 否 |
| `ENABLE_R2_CDN` | 是否启用 R2 CDN（默认关闭） | 否 |

### KV 命名空间绑定
- `USER_DATA` - 用户数据存储

### R2 存储绑定
- `BUCKET` - 图标文件存储（可选）

## 🎯 使用指南

### 基本操作
1. **登录**：打开页面后输入密码登录
2. **添加网站**：右键点击空白处进入编辑模式，点击"+"按钮添加新网站
3. **修改网站**：右键点击网站图标，选择"修改"
4. **删除网站**：右键点击网站图标，选择"删除"
5. **创建文件夹**：拖拽一个网站图标到另一个网站图标上
6. **移动图标**：拖拽网站图标到文件夹图标上移入文件夹
7. **移出文件夹**：在文件夹中拖拽图标到文件夹窗口外

### 搜索功能
1. 在搜索框中输入关键词
2. 点击搜索引擎图标切换搜索引擎
3. 按回车或点击搜索按钮执行搜索

### 壁纸设置
1. 点击设置按钮（⚙️）打开设置面板
2. 选择"壁纸设置"
3. 选择壁纸来源（Bing每日壁纸/随机Bing壁纸/本地图片/纯色背景）
4. 调整模糊度和遮罩浓度

### 导入预设站点
1. 打开设置面板
2. 选择"导入预设站点"
3. 选择要导入的站点
4. 点击"导入"按钮

## 📁 项目结构

```
harborpage/
├── src/                          # 前端源代码
│   ├── components/               # React组件
│   │   ├── common/               # 通用组件
│   │   │   ├── ConfirmDialog.tsx
│   │   │   ├── EditWebsite.tsx
│   │   │   ├── FolderItem.tsx
│   │   │   ├── IconItem.tsx
│   │   │   ├── LoginModal.tsx
│   │   │   ├── Notes.tsx
│   │   │   ├── TodoList.tsx
│   │   │   └── WebsiteItem.tsx
│   │   ├── features/             # 功能组件
│   │   │   ├── FolderWindow.tsx
│   │   │   ├── Search.tsx
│   │   │   ├── SearchManager.tsx
│   │   │   ├── TodoSidebar.tsx
│   │   │   ├── WallpaperManager.tsx
│   │   │   └── Weather.tsx
│   │   ├── layout/               # 布局组件
│   │   │   ├── Background.tsx
│   │   │   └── IconsContainer.tsx
│   │   └── ui/                   # UI组件
│   │       ├── IconSettings.tsx
│   │       ├── ImportFileDialog.tsx
│   │       ├── ImportPresetDialog.tsx
│   │       ├── Settings.tsx
│   │       └── SettingsWindow.tsx
│   ├── data/                     # 数据文件
│   │   └── presetSites.json      # 预设站点数据
│   ├── hooks/                    # 自定义Hooks
│   │   ├── useClickOutside.ts
│   │   ├── useDragAndDrop.ts
│   │   └── useImport.ts
│   ├── services/                 # 服务层
│   │   ├── AuthService.ts        # 认证服务
│   │   ├── ConfigService.ts      # 配置服务
│   │   ├── DataManager.ts        # 数据管理
│   │   ├── IconDownloadQueue.ts  # 图标下载队列
│   │   ├── IconManager.ts        # 图标管理器
│   │   └── ServicesContext.tsx   # 服务上下文
│   ├── store/                    # 状态管理
│   │   ├── useIconsStore.ts      # 图标状态
│   │   └── useSettingsStore.ts   # 设置状态
│   ├── types/                    # 类型定义
│   │   └── index.ts
│   ├── utils/                    # 工具函数
│   │   ├── deviceUtils.ts
│   │   └── importExportUtils.ts
│   ├── App.tsx                   # 主应用组件
│   ├── main.tsx                  # 应用入口
│   └── index.css                 # 全局样式
├── worker/                       # Cloudflare Workers代码
│   ├── middleware/               # 中间件
│   │   └── auth.ts               # 认证中间件
│   ├── routes/                   # API路由
│   │   ├── auth.ts               # 认证接口
│   │   ├── bing.ts               # Bing壁纸接口
│   │   ├── data.ts               # 数据接口
│   │   ├── icon.ts               # 图标接口
│   │   ├── wallpaper.ts          # 壁纸代理接口
│   │   └── weather.ts            # 天气接口
│   ├── utils/                    # Worker工具函数
│   │   ├── crypto.ts             # 加密工具
│   │   └── icon.ts               # 图标处理工具
│   ├── index.ts                  # Worker入口文件
│   └── types.ts                  # Worker类型定义
├── public/                       # 静态资源
├── .dev.vars.sample              # 本地环境变量示例
├── .env.sample                   # 前端构建变量示例
├── wrangler.sample.jsonc         # Wrangler配置示例
└── package.json                  # 项目配置
```

## 🔧 API 接口

### 认证
- `POST /api/login` - 用户登录
- `GET /api/auth/status` - 检查认证状态

### 数据管理
- `GET /api/data` - 获取用户数据
- `GET /api/data?key={key}` - 获取单个数据项
- `POST /api/data?key={key}` - 保存用户数据
- `DELETE /api/data?key={key}` - 删除用户数据

### 图标管理
- `GET /api/icon?type={type}&hashInput={hashInput}&downloadUrl={downloadUrl}` - 获取图标（从R2获取或下载）
- `POST /api/icon` - 下载并缓存图标到 R2（缓存模式不需要认证）
- `POST /api/icon/upload` - 上传图标（需认证，R2可用时，文件大小限制100KB）
- `DELETE /api/icon?type={type}&hashInput={hashInput}` - 删除图标（需认证）
- `DELETE /api/icon?action=cleanup` - 清理未使用的图标（需认证，支持分批清理）

### 天气服务
- `GET /api/weather?lat={lat}&lon={lon}` - 获取天气信息
- `GET /api/geo?location={location}` - 城市搜索

### 壁纸代理
- `GET /api/wallpaper?url={url}` - 壁纸图片代理（白名单限制）

### Bing API 代理
- `GET /api/bing/*` - 代理 Bing API 请求（如 `/api/bing/HPImageArchive.aspx?format=js&idx=0&n=1` 获取每日壁纸）

## 🎨 自定义

### 添加自定义搜索引擎
1. 打开设置面板
2. 选择"搜索设置"
3. 点击"管理搜索引擎"
4. 添加新的搜索引擎信息

### 修改图标行列数
1. 打开设置面板
2. 选择"图标设置"
3. 调整行数和列数

### 启用 R2 图标缓存
1. 创建 R2 存储桶并绑定
2. 配置 `R2_URL` 环境变量
3. 设置 `ENABLE_R2_CDN` 为 `"true"`

## 📝 开发说明

### 组件化开发
项目采用组件化开发模式，每个功能模块都有独立的组件和样式文件。

### 状态管理
使用 Zustand 进行全局状态管理，数据持久化到 Cloudflare KV。

### 服务注入
服务通过 `ServicesContext` 注入，避免直接导入导致的耦合问题。

### 样式规范
- 组件样式独立管理
- 使用 CSS 变量保持一致性
- 响应式设计

### 安全规范
- JWT 认证保护所有敏感 API
- 密码 SHA-256 加密传输
- 壁纸代理域名白名单限制（bing.com、s.cn.bing.net、images.unsplash.com、bing.img.run）
- 请求大小限制（壁纸最大 10MB）
- 敏感变量存储在 `.dev.vars`（本地）或 Cloudflare Secrets（生产）

### 图标管理规范
- R2 存储路径前缀：`WebSites/` 用于网站图标，`SearchEngines/` 用于搜索引擎图标
- 用户上传图标使用 `type_id_domain_timestamp` 生成 MD5 哈希命名
- 非用户上传图标使用 `hashInput`（域名或图标URL）生成 MD5 哈希命名
- R2 存储仅在 `R2_URL` 和 R2 BUCKET 都配置时生效
- 图标下载队列使用 GET 请求调用缓存接口（避免认证要求）

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT License

## 🙏 致谢

- [React](https://react.dev/)
- [Vite](https://vitejs.dev/)
- [Cloudflare Workers](https://workers.cloudflare.com/)
- [和风天气](https://www.qweather.com/)
- [Zustand](https://zustand-demo.pmnd.rs/)
- [lunisolar](https://lunisolar.js.org/)
- [qweather-icons](https://github.com/qwd/Icons)
