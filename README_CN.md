# HarborPage - 个人导航页面

一个基于 React + Vite + Cloudflare Workers 构建的现代化个人导航页面，支持网站图标管理、文件夹分类、搜索引擎切换、天气显示、待办事项、笔记、数据导入导出等功能，并内置简体中文 / English 双语界面。

## 📸 界面预览

主界面全景：

<p align="center">
  <img src="screenshots/Demo.jpg" width="620" alt="主界面" />
  <br />
  <sub><b>主界面</b> · 壁纸 + 图标网格 + 搜索 / 天气 / 两侧半藏水晶球入口</sub>
</p>

三个边缘入口球功能：

<table align="center">
  <tr>
    <td align="center">
      <img src="screenshots/Pages.jpg" width="396" alt="多页面侧边栏" />
      <br />
      <sub><b>多页面</b> · 左缘入口球展开 PagesSidebar</sub>
    </td>
    <td align="center">
      <img src="screenshots/TodoList.jpg" width="396" alt="待办侧边栏" />
      <br />
      <sub><b>待办事项</b> · 右缘入口球展开待办侧边栏</sub>
    </td>
    <td align="center">
      <img src="screenshots/Notes.jpg" width="396" alt="笔记便签栏" />
      <br />
      <sub><b>笔记</b> · 底部入口球悬停展开便签栏</sub>
    </td>
  </tr>
</table>

窗口与对话框：

<p align="center">
  <img src="screenshots/Folder.jpg" width="560" alt="文件夹窗口" />
  <br />
  <sub><b>文件夹窗口</b> · 水晶方块图标 + 材质色分层玻璃（配色随文件夹颜色联动）</sub>
</p>

<p align="center">
  <img src="screenshots/About.png" width="240" alt="关于对话框" />
  <br />
  <sub><b>关于</b> · 关于 HarborPage 对话框</sub>
</p>

## ✨ 功能特性

### 🌐 网站图标管理
- 添加、修改、删除网站快捷方式
- 多来源图标获取：HTML 解析、常见路径探测、多 Favicon 源 fallback
- 支持三种图标输入方式：图标 URL、文字（生成带颜色文字图标）、Emoji
- 图标智能获取对话框：自动从多种渠道收集候选图标供用户选择
- 图标缓存到 Cloudflare R2（可选），前端信号量并发控制（3 并发）
- 拖拽排序和移动图标：投放区覆盖整个图标网格，图标盒子与图标之间的空隙都能投放，空隙按最近的相邻图标归属
- 右键菜单快速操作
- 触屏长按图标弹出同一套操作菜单（长按起拖、原地松手即弹菜单），长按空白处进入编辑模式
- 图标 / 文件夹图标以「水晶方块」玻璃质感呈现，可用全局调色板 16 色或自定义颜色着色（详见下方「配色体系」）

### 📁 文件夹功能
- 拖拽图标到另一个图标上创建文件夹
- 文件夹图标显示前4个网站的图标（田字形排列）
- 支持文件夹名称修改
- 拖拽图标移入/移出文件夹
- 空文件夹显示📁图标
- 文件夹窗口整体配色随文件夹当前颜色联动（半透明材质分层染色，头部/内容区/底部各有层次，保留玻璃质感）
- 文件夹窗口空白处右键可直接添加网站到当前文件夹
- 空文件夹内容区至少保留一行图标高度，方便查看与拖入操作
- 支持整文件夹在页面之间移动（包含内部所有子网站）

### 🎨 配色体系：全局调色板与取色器
- **16 个全局调色板槽**：位置固定（`palette-1 … palette-16`，只表位置、不含颜色语义），出厂默认 16 色（白色置首，其余按色相渐变），槽位颜色可在设置面板中随时重设
- **取色器窗口**：在 16 个系统预设色 + 「自定义」之间取色（彩虹渐变 + 原生取色器）；修改槽位时可「恢复默认」还原出厂色
- **选择模式（给元素设色）**：网站、文件夹、笔记的颜色选择共用同一调色板——点槽即选中该槽颜色；再次点击已选中的槽位或「自定义」按钮会弹出取色器
- **设置模式（设置面板）**：点击任意槽直接弹取色器改色，绑定该槽位的图标、文件夹、笔记实时联动变色
- **自然换行布局**：16 槽与自定义按钮处于同一 flex-wrap 流，按所在容器宽度自然排列（如笔记编辑窗一行铺开、修改站点弹窗自动折行、文件夹设色 4×4、设置侧栏 2×8）
- **友好的颜色提示**：出厂预设槽提示中文色名（白色、黄色、蓝色…），自定义颜色提示十六进制值
- **平滑兼容**：旧数据中的颜色名 / 快照色照常显示并在读取后自动升级为槽位引用；调色板改动参与云端同步与导入导出

### 🗂️ 多页面功能
- 页面级隔离：每个页面拥有独立的网站和文件夹集合
- 屏幕左缘半藏一颗「水晶球」入口球（翠绿→琥珀身份色，六层渐变 + 呼吸辉光），悬停滑出显形、点击展开 PagesSidebar（面板打开后入口球旋转淡出让位，点面板外任意处收起）
- 页面创建、重命名、删除（至少保留一页）
- 拖拽排序页面（Pointer Events 统一实现：桌面位移即拖、触屏长按起拖；上下半区指示线）
- 网站/文件夹跨页移动：右键菜单「移动到页面…」，支持「仅移动」与「移动并跳转」
- 刷新页面默认显示第一页（当前选中的页面不写入持久化存储）
- 旧格式（根级 websites 无 pages）数据自动迁移至名为「默认页面」的页面
- 导入旧格式数据时始终落于「默认页面」（不存在则自动创建），导入完成后自动跳转到该页

### 🔍 搜索功能
- 多搜索引擎支持（Google、百度、必应等）
- 自定义添加、编辑、删除搜索引擎
- 搜索引擎图标自动获取
- 拖拽排序搜索引擎
- 主页面下拉快速切换搜索引擎（临时切换，不写入持久化，不触发保存提示）
- 设置面板中可修改默认搜索引擎（正常持久化、同步到云端）

### 🌤️ 天气显示
- 实时天气信息显示
- 支持浏览器定位和IP定位
- 多供应商天气 API 支持（内置和风天气、Open-Meteo 适配器，可通过 `WEATHER_PROVIDER` 切换 / 扩展）
- 显示当前温度和天气状态
- 显示时间和日期（点击日期切换农历）
- 时钟使用 ref 直接 DOM 操作，避免每秒触发 React 重渲染

### ✅ 待办事项
- 屏幕右缘半藏一颗「水晶球」入口球（靛蓝→品红身份色，与页面入口球同款画法），点击展开待办侧边栏（关闭：点面板外任意处）
- 添加、编辑、删除待办事项
- 标记完成状态
- 数据持久化存储到 Cloudflare KV
- 未完成数量徽章显示（叠加在入口球左上角）

### 📝 笔记功能
- 屏幕底部居中的「水晶球」便签栏：收起时只露半颗 📝 peek 球，鼠标悬停即整栏升起展开
- 笔记球最多显示 8 篇，每颗球按笔记颜色做成水晶球、取标题首字显示，悬停弹出缩略预览气泡（含更新时间与「编辑」入口）
- 笔记球支持拖拽排序；点击任意球直接打开编辑器（全文查看、修改标题/颜色/内容、保存或删除）
- 左侧「+」新建笔记（点「保存」才真正创建）、右侧「⚙︎」打开笔记管理器（查看全部、批量重排、重命名、调色、删除），超过 8 篇时叠加 +N 徽章
- 支持标题和内容、创建与更新时间记录
- 笔记颜色取自全局调色板（16 槽 + 自定义），与网站/文件夹颜色体系统一联动

### 🎨 壁纸管理
- 渐变背景（默认）
- 纯色背景
- Bing 每日壁纸
- 随机 Bing 壁纸
- 自定义图片 URL
- 本地图片上传（R2 或 IndexedDB 降级存储）
- 模糊度和遮罩浓度调节
- 壁纸代理支持（域名白名单限制）
- 自动定时更换壁纸：可开启并设置 1–24 小时更换间隔（仅对 Bing 每日 / 随机 Bing / 自定义 URL 生效，计时锚点存在本机，不入云）

### 📤 数据导入导出
- 分类导出：搜索引擎、页面（含网站）、网站（旧格式）、待办列表、笔记、其它设置、调色板
- 分类导入：勾选需要导入的数据类别（调色板仅在被改动过时提供，按槽位合并）
- 导入时自动检测文件中不存在的数据并禁用选择
- 导入进度条显示当前进度及任务内容
- 导入时遮罩层禁止用户操作
- 导入时 ID 冲突自动处理（合并模式生成新 ID）
- 导入后图标自动预缓存

### 🔐 安全认证
- JWT 登录认证
- 密码 SHA-256 加密传输
- 7天 Token 有效期
- 自动登出处理
- 敏感信息存储在 Cloudflare Secrets
- 构建产物自动清理 .dev.vars 机密文件

### 🌏 多语言界面（i18n）
- 内置简体中文 / English 两套界面文案，覆盖 16 个命名空间（通用、设置、认证、关于、天气、待办、笔记、搜索、页面、文件夹、壁纸、站点、图标、导入导出、功能 Dock、系统）
- 语言自动检测：本地存储的语言偏好 → 浏览器语言 → 默认简体中文
- 在设置面板 → 个性化 → 界面语言随时切换，切换即时生效并本地持久化（键 `harborpage_language`）
- 后端 API 只返回语言无关的错误码 / 图标源标识（`shared/apiErrors.ts`），前端统一翻译（`src/utils/apiErrorUtils.ts`）

### ⚙️ 设置面板（右侧抽屉式，分组管理）
- **个性化**：网站标题、界面语言、更改壁纸、桌面图标设置（行列数）、管理图标源、调色板管理（2×8 设置模式，点击任意槽改色并为槽位设置别名，全局明暗度调节 −50~50 且支持实时预览；使用该槽颜色的图标、文件夹、笔记自动联动）
- **偏好设置**：管理搜索引擎、自动保存设置
- **功能开关**：天气 / 搜索 / 笔记 / 待办 / 多页面 五个模块的显示开关（关闭后对应入口球与功能面板一并隐藏）
- **数据管理**：从云端加载数据、导入预设站点、数据导入/导出、清空所有站点
- **账户与关于**：注销登录、关于 HarborPage

### 💾 自动保存
- 未保存变更检测与提示
- 倒计时自动保存（可配置时长）
- 保存进度指示
- 手动保存与自动保存并存
- 页面刷新前未保存提示

## 🛠️ 技术栈

### 前端
- **React 19** - 用户界面库
- **TypeScript** - 类型安全
- **Vite 7** - 构建工具
- **Zustand 5** - 状态管理
- **i18next 26 + react-i18next 17** - 国际化（i18n）
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
- Node.js 20.19+ / 22.12+（Vite 7 要求）
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

### 常用脚本

| 命令 | 说明 |
|------|------|
| `npm run dev` | 启动开发服务器（`wrangler dev`，带热重载） |
| `npm run dev:vite` | 仅启动 Vite 前端开发服务器 |
| `npm run build` | 类型检查并构建生产产物 |
| `npm run build:watch` | 构建并监听变更（watch 模式） |
| `npm run preview` | 构建后在本地预览 Worker |
| `npm run deploy` | 构建并部署到 Cloudflare Workers |
| `npm run cf-typegen` | 生成 Cloudflare Workers 类型 |
| `npm run lint` | 运行 ESLint |

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
   - 配置 `WEATHER_PROVIDER`（非敏感，直接写在 `vars` 中，取值 `qweather` / `openmeteo`）

### 环境变量说明

| 变量名 | 说明 | 是否必需 |
|--------|------|----------|
| `PASSWORD` | 登录密码 | 是 |
| `JWT_SECRET` | JWT 签名密钥 | 是 |
| `WEATHER_PROVIDER` | 天气功能开关 + 供应商（在 `wrangler.jsonc` 的 `vars` 中配置，可选 `qweather`、`openmeteo`；**不填写则不启用天气功能**） | 否 |
| `WEATHER_API_KEY` | 天气 API 密钥（和风天气；使用 `openmeteo` 时无需配置） | 否 |
| `WEATHER_API_HOST` | 天气 API 主机地址（和风天气；使用 `openmeteo` 时无需配置） | 否 |
| `R2_URL` | R2 存储访问地址（启用 R2 CDN 时需要） | 否 |
| `ENABLE_R2_CDN` | 是否启用 R2 CDN（默认关闭） | 否 |

### KV 命名空间绑定
- `USER_DATA` - 用户数据存储

### R2 存储绑定
- `BUCKET` - 图标文件存储（可选）

## 🎯 使用指南

### 基本操作
1. **登录**：打开页面后输入密码登录
2. **切换页面**：点击屏幕左缘的翠绿→琥珀「水晶球」入口球展开 PagesSidebar，点击页面切换（点面板外任意处收起）；拖拽手柄可重新排序
3. **新建页面**：PagesSidebar 顶部「+ 新建页面」按钮
4. **重命名/删除页面**：页面项右侧铅笔图标重命名（Enter 提交 / Esc 取消）、垃圾桶图标删除（需二次确认，至少保留一页）
5. **添加网站**：右键页面空白处直接打开「新增网站」窗口；长按空白进入编辑模式后点击「+」也可新增。文件夹窗口内右键空白处添加的站点会进入当前文件夹
6. **修改网站**：右键点击网站图标，选择"修改"
7. **删除网站**：右键点击网站图标，选择"删除"
8. **给元素设置颜色**：网站/文件夹的编辑弹窗与笔记编辑器共用同一套调色板——点选 16 个槽位之一即上色；点「自定义」或再次点击已选中的槽位会弹出取色器
9. **管理调色板**：设置 → 个性化 → 调色板，点击任意色块重设该槽颜色，使用该槽的图标、文件夹、笔记实时联动
10. **创建文件夹**：拖拽一个网站图标到另一个网站图标上
11. **移动图标**：拖拽网站图标到文件夹图标上移入文件夹
12. **移出文件夹**：在文件夹中拖拽图标到文件夹窗口外
13. **跨页移动网站/文件夹**：右键点击网站或文件夹 → 「移动到页面…」→ 选择「仅移动」或「移动并跳转」
14. **打开待办**：点击屏幕右缘的靛蓝→品红「水晶球」入口球展开待办侧边栏（点面板外任意处收起），左上角徽章实时显示未完成数量
15. **打开笔记栏**：鼠标悬停屏幕底部中央的 📝「水晶球」便签球即整栏展开——悬停笔记球看缩略预览、点击球打开编辑器、拖拽球排序、右侧「⚙︎」管理全部笔记
16. **切换界面语言**：设置 → 个性化 → 界面语言，在简体中文 / English 之间切换（即时生效并本地持久化）

### 图标设置
- **留空**：自动获取网站 favicon
- **图标 URL**：直接填写图片链接
- **文字**：输入任意文字（如 "Ba"），生成带颜色的文字图标
- **Emoji**：输入 emoji 字符（如 🚀）
- **上传**：手动上传图标到 R2
- **智能获取**：自动从 HTML、常见路径、图标源获取候选图标

### 搜索功能
1. 在搜索框中输入关键词
2. 点击搜索引擎图标或下拉切换搜索引擎（**主页面切换为临时选择，刷新后回到默认搜索引擎**）
3. 按回车或点击搜索按钮执行搜索
4. 如需永久修改默认搜索引擎：设置面板 → 搜索设置 → 管理搜索引擎

### 壁纸设置
1. 点击设置按钮（⚙️）打开设置面板
2. 选择"壁纸设置"
3. 选择壁纸来源（渐变背景 / 纯色背景 / Bing 每日壁纸 / 随机 Bing 壁纸 / 自定义图片 URL / 本地图片）
4. 调整模糊度和遮罩浓度
5. 如需自动更换：开启后设置 1–24 小时更换间隔（仅 Bing 每日 / 随机 Bing / 自定义 URL 生效）

### 数据导入导出
1. 打开设置面板
2. 选择"导入导出"
3. 导出：勾选需要导出的数据类别，点击导出
4. 导入：选择导入文件后，勾选需要导入的数据类别，确认导入
5. 导入过程中会显示进度条，禁止其他操作

## 📁 项目结构

```
harborpage/
├── shared/                          # 前后端共享代码
│   ├── apiErrors.ts                 # API 错误码 / 图标源标识（语言无关，供前端 i18n 翻译）
│   ├── constants.ts                 # TRACKED_KEYS 持久化追踪键（含 palette / paletteAliases / paletteLightness）
│   └── weather.ts                   # 归一化天气模型（供应商无关的图标码 / 地点 / 实时天气契约）
├── public/                          # 静态资源
├── screenshots/                     # 界面预览截图
├── samples/                         # 设计参考样例（纯 HTML）
│   ├── CrystalBall.html             # 水晶球画法参考（边缘入口球 / 笔记球）
│   ├── Crystal_block.html           # 水晶方块（图标）边缘内高光参考
│   ├── New.html / v3.html           # 界面版式参考
├── src/                             # 前端源代码
│   ├── assets/                      # 静态资源
│   ├── components/                  # React 组件（样式为同文件名 .css）
│   │   ├── common/                  # 通用组件
│   │   │   ├── AboutDialog.tsx      # 「关于」弹窗
│   │   │   ├── AutoFetchDialog.tsx  # 智能获取图标对话框
│   │   │   ├── ColorPickerWindow.tsx# 取色器窗口（16 预设 + 自定义 + 恢复默认）
│   │   │   ├── ConfirmDialog.tsx    # 确认对话框
│   │   │   ├── CrystalShell.tsx     # 水晶图标光效层集合（站点/文件夹图标共用）
│   │   │   ├── DraggableIconWrapper.tsx # 拖拽包装层
│   │   │   ├── EditWebsite.tsx      # 网站/文件夹编辑表单（含调色板）
│   │   │   ├── ErrorBoundary.tsx    # 错误边界
│   │   │   ├── FeatureDock.tsx      # 功能 Dock：消费注册表，按槽位配置渲染共享入口球
│   │   │   ├── FolderItem.tsx       # 文件夹图标
│   │   │   ├── FolderNameDialog.tsx # 文件夹命名对话框
│   │   │   ├── IconGrid.tsx         # 图标网格
│   │   │   ├── IconItem.tsx         # 图标项（水晶方块）
│   │   │   ├── ImportProgressOverlay.tsx # 导入进度遮罩
│   │   │   ├── LoginModal.tsx       # 登录弹窗
│   │   │   ├── MoveToPageDialog.tsx # 跨页移动对话框
│   │   │   ├── Notes.tsx            # 笔记组件
│   │   │   ├── PalettePicker.tsx    # 调色板（选择/设置模式，flex-wrap 自然换行）
│   │   │   ├── PeekBall.tsx         # 共享「水晶球」入口球（纯呈现；样式 PeekBall.css）
│   │   │   ├── SaveProgressIndicator.tsx / SavePrompt.tsx / SaveTooltip.tsx  # 保存反馈
│   │   │   ├── Toast.tsx            # 轻提示
│   │   │   ├── TodoList.tsx         # 待办列表
│   │   │   ├── TreeSelector.tsx     # 树形选择器
│   │   │   └── WebsiteItem.tsx      # 网站项（含右键菜单）
│   │   ├── features/                # 功能组件
│   │   │   ├── FolderWindow.tsx     # 文件夹窗口（配色随文件夹颜色）
│   │   │   ├── PagesSidebar.tsx     # 页面侧边栏（多页面切换/排序/重命名/删除）
│   │   │   ├── Search.tsx           # 搜索栏
│   │   │   ├── SearchManager.tsx    # 搜索引擎管理
│   │   │   ├── TodoSidebar.tsx      # 待办侧边栏
│   │   │   ├── WallpaperManager.tsx # 壁纸管理
│   │   │   └── Weather.tsx          # 天气显示
│   │   ├── layout/                  # 布局组件
│   │   │   ├── Background.tsx       # 背景层
│   │   │   └── IconsContainer.tsx   # 图标容器
│   │   └── ui/                      # UI 组件
│   │       ├── AutoSaveSettings.tsx # 自动保存设置
│   │       ├── FaviconSettings.tsx  # 图标源设置
│   │       ├── IconSettings.tsx     # 桌面图标设置
│   │       ├── ImportExport.tsx     # 数据导入导出（含调色板类别）
│   │       ├── ImportPresetDialog.tsx # 预设站点导入
│   │       ├── NoteBar.tsx          # 底部水晶便签栏（peek 展开）
│   │       ├── NoteEditorDialog.tsx # 笔记编辑器（含调色板取色）
│   │       ├── NotesManagerDialog.tsx # 笔记管理器
│   │       ├── Settings.tsx         # 设置面板（含调色板管理）
│   │       └── SettingsWindow.tsx   # 设置窗口外壳
│   ├── data/                        # 数据文件
│   │   └── presetSites.json         # 预设站点数据
│   ├── hooks/                       # 自定义 Hooks
│   │   ├── useAuth / useAutoSave / useAutoSaveSettings / useClickOutside / useFeatureEntry
│   │   ├── useDataInitialization / useDeleteIcon / useDragAndDrop / useIconDropHandler
│   │   ├── useListPointerReorder（一维列表排序）/ usePointerDrag（统一指针拖拽引擎）
│   │   ├── useImport / useLongPress / useAddWebsiteShortcut / useTreeSelection
│   │   └── useWallpaperInit / useWallpaperAutoChange / useWeather / useWeatherLocation / useWeatherLunar
│   ├── i18n/                        # 国际化（i18next）
│   │   ├── locales/                 # zh-CN / en-US 各 16 个命名空间文案
│   │   ├── index.ts                 # 语言检测 / 初始化 / 切换
│   │   └── i18next.d.ts             # 类型声明
│   ├── services/                    # 服务层
│   │   ├── AuthService / ConfigService / FaviconConfigService / ChangeTracker
│   │   ├── DataRepository           # 统一持久化层
│   │   ├── DataManager / storeInitializer
│   │   ├── IconManager / IconDownloadQueue / autoFetchService / iconUtils
│   │   └── Services / serviceContainer
│   ├── store/                       # 状态管理（Zustand）
│   │   ├── useFeatureDockStore.ts   # 功能 Dock 注册中心（入口描述符 entries + 面板开合 open）
│   │   ├── usePagesStore.ts         # 页面 + 页面级网站集合（真源）
│   │   ├── useIconsStore.ts         # 当前页图标视图（派生）
│   │   ├── usePaletteStore.ts       # 全局调色板（16 槽）
│   │   ├── useNotesStore / useTodoStore / useSearchStore / useSettingsStore
│   │   ├── useWallpaperStore / useImportStore / useIconsUIStore
│   │   └── index.ts / persistence.ts / selectors.ts
│   ├── types/index.ts               # 类型定义（含 palette-1…16 槽位说明）
│   ├── utils/                       # 工具函数
│   │   ├── paletteColors.ts         # 调色板核心（槽位归一化/色名描述/选择构造/全局明暗度）
│   │   ├── noteColors.ts            # 笔记预设色
│   │   ├── colorUtils.ts            # 颜色换算（hex/hsl 等）
│   │   ├── apiErrorUtils.ts         # API 错误码 → i18n 文案翻译
│   │   ├── wallpaperRefresh.ts      # Bing 壁纸抓取 / 随机壁纸 / 缓存破除
│   │   └── deviceUtils / dropGeometry / idUtils / importExportUtils / logger / wallpaperStorage
│   ├── App.tsx / main.tsx / constants.ts / index.css / App.css
├── worker/                          # Cloudflare Workers 代码
│   ├── middleware/
│   │   └── auth.ts                  # 认证中间件
│   ├── routes/                      # API 路由（auth/data/icon/icon-upload/icon-cleanup/title/bing/wallpaper/wallpaper-upload/weather）
│   ├── utils/                       # constants/crypto/icon/md5/streamLimit
│   ├── weather/                     # 天气供应商抽象层
│   │   ├── types.ts                 # WeatherProvider 适配器接口
│   │   ├── registry.ts              # 供应商注册表 / WEATHER_PROVIDER 选择
│   │   ├── providers/qweather.ts    # 和风天气适配器
│   │   └── providers/openmeteo.ts   # Open-Meteo 适配器（无需密钥）
│   ├── index.ts                     # Worker 入口
│   └── types.ts                     # Worker 类型
├── .dev.vars.sample                 # 本地环境变量示例
├── .env.sample                      # 前端构建变量示例
├── wrangler.sample.jsonc            # Wrangler 配置示例
├── vite.config.ts / package.json / tsconfig*.json
└── LICENSE
```

## 🔧 API 接口

### 认证
- `POST /api/login` - 用户登录
- `GET /api/auth/status` - 检查认证状态
- `GET /api/config` - 获取前端运行时配置（需认证，返回 `r2Url` / `enableR2Cdn` / `r2StorageAvailable` / `weatherApiAvailable` / `weatherProvider`）

### 数据管理
- `GET /api/data` - 获取全部用户数据
- `GET /api/data?key={key}` - 获取单个数据项
- `POST /api/data?key={key}` - 保存用户数据
- `DELETE /api/data?key={key}` - 删除用户数据

### 图标管理
- `GET /api/icon?type={type}&hashInput={hashInput}&downloadUrl={downloadUrl}` - 获取图标（从R2获取或下载）
- `POST /api/icon` - 下载并缓存图标到 R2
- `POST /api/icon/upload` - 上传图标（需认证，R2可用时，文件大小限制100KB）
- `DELETE /api/icon?type={type}&hashInput={hashInput}` - 删除图标（需认证）
- `DELETE /api/icon?action=cleanup` - 清理未使用的图标（需认证，支持分批清理）
- `GET /api/icon/autofetch?url={url}` - 获取网站图标候选列表（仅分析页面结构，不下载）
- `POST /api/icon/download` - 下载单个图标并返回 data URL（供前端并发调用）
- `POST /api/icon/autofetch/cache` - 将 data URL 图标缓存到 R2
- `POST /api/icon/cache-url` - 将指定 URL 的图标缓存到 R2

### 图标源管理
- `GET /api/icon/sources/defaults` - 获取系统默认图标源（无需认证）
- `GET /api/favicon/sources` - 获取 Favicon 源配置
- `POST /api/favicon/sources` - 保存 Favicon 源配置

### 天气服务
- `GET /api/weather?lat={lat}&lon={lon}&lang={lang}` - 获取归一化实时天气（温度 / 天气现象 / 湿度 / 归一化图标码）
- `GET /api/geo?location={location}&lang={lang}` - 城市搜索（返回归一化地点列表）

> 说明：和风天气支持「按坐标反查城市」，因此定位后可显示城市名；Open-Meteo 官方 Geocoding 仅支持按名称搜索，使用 `openmeteo` 时城市名会回退为「未知城市」，但天气数据不受影响。

### 壁纸代理
- `GET /api/wallpaper?url={url}` - 壁纸图片代理（域名白名单限制）
- `POST /api/wallpaper/upload` - 上传壁纸到 R2

### Bing API 代理
- `GET /api/bing/*` - 代理 Bing API 请求

### 标题获取
- `GET /api/title?url={url}` - 获取网站标题

## 🎨 自定义

### 添加自定义搜索引擎
1. 打开设置面板
2. 选择"搜索设置"
3. 点击"管理搜索引擎"
4. 点击添加或编辑现有搜索引擎

### 配置 Favicon 源
1. 打开设置面板
2. 选择"图标源设置"
3. 添加、编辑、删除或拖拽排序 Favicon 源
- 系统默认提供 Google、DuckDuckGo、Favicon 三个源（默认源由后端统一提供，前端通过 `GET /api/icon/sources/defaults` 获取）
- 按优先级依次尝试，直到获取到有效图标

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

### 功能 Dock 架构（Peek 球入口体系）

多页面 / 待办 / 便签的「边缘入口球」统一由一套倒置依赖体系驱动（映射 WPF 的"功能创建入口球 → 宿主配置并渲染"模型）：

- **注册中心**：`useFeatureDockStore`（Zustand）持有 `entries`（入口描述符）与 `open`（面板开合）两张表
- **功能侧注册**：功能组件通过 `useFeatureEntry(id, descriptor)` 在挂载时 `register`、卸载时 `unregister` —— 功能开关关闭（或未登录）→ 组件卸载 → 入口球自动消失、`open` 状态一并清理，宿主无需维护开关；每次渲染后 `updateEntry` 把最新 label / 角标 / 悬停回调同步进注册表
- **宿主渲染**：`FeatureDock` 不 import 任何功能组件，只按静态槽位表消费注册表。每槽配置三项工作参数——放置位置（placement）、呈现方式（presentation）、交互方式（interaction），`entry` 缺失则对应槽不渲染
- **共享入口球**：`PeekBall` 为纯呈现组件（与功能零耦合），只收 `entry`（内容）+ `slot`（工作参数）+ `active` + `onOpen/onToggle`
- **开合联动**：`open` 是球与功能面板的单一事实源——球读它决定 `is-active` 视觉；面板读它决定挂载（`present`）与展开（`expanded`）。面板挂载/收起由定时器异步驱动（先以收起态挂载一帧 → 30ms 补展开滑入；关闭先收起 → 退场动画播完卸载并清理二次确认等瞬态），同步 setState 不放在 effect / 渲染期调整内，规避 React 19 首个交互偶发丢状态问题
- **槽位与交互**：`pages` / `todos` = `panel-slide` + `click-toggle`（点击展开，打开后球旋转 180° 淡出让位、点面板外收起）；`notes` = `bar-reveal` + `hover-open`（悬停展开、经 `onHoverEnd` 离开即收，触屏点按兜底打开）

### 视觉设计（水晶球体系）
- 页面（左缘）、待办（右缘）、笔记栏 peek（底缘）三个「边缘入口球」与笔记球统一采用 `samples/CrystalBall.html` 的水晶球画法
- 水晶球 = 同一元素上的六层渐变（深色玻璃底 → 低透明身份色内部光 → 主/次高光 → 底部月牙反光）+ inset 内壁折射 + 底部身份色氛围光，**不使用白描边环**（避免塑料感）
- 三个边缘入口球由共享 `PeekBall` 组件统一渲染（`FeatureDock` 按槽位放置）：身份色 `--tint` / `--tint-2` 来自功能注册的描述符并内联到球根，7 个 `--ball-*` 派生变量在 PeekBall.css 内 `color-mix` 统一生成
- 呼吸动画默认 `paused`（避免静止时持续 raster 占用 CPU），仅在 hover / 展开时运行
- 网站 / 文件夹图标为「水晶方块」玻璃质感：由 `CrystalShell` 提供光效层、IconItem.css 的 `.icon-circle > .cc-*` 驱动，按 `samples/Crystal_block.html` 增加 inset 边缘内高光（玻璃厚度感），颜色以 `--c-hue/--c-sat/--c-lit` HSL 变量驱动并随调色板联动，hover 内光增强
- 文件夹窗口配色随文件夹当前颜色（`--fc-hue/--fc-sat/--fc-lit`）做分层材质染色（顶部受光 / 中部透明 / 底部回光），仍保留半透明玻璃质感

### 交互健壮性
- 所有 `Node.contains()` 调用前先做 `relatedTarget instanceof Node` 守卫：鼠标快速甩出窗口时浏览器会把 relatedTarget 映射为 `window`，未守卫的 `contains(window)` 会抛 `TypeError` 并中断后续逻辑（曾导致笔记栏 hover 收起被卡死）
- 该守卫覆盖 NoteBar（栏移出/球拖拽/气泡穿越）、PagesSidebar、Todo 侧边栏、NotesManagerDialog、FolderWindow 及 useDragAndDrop / useClickOutside 全部相关路径

### 拖拽体系（Pointer Events 统一实现）
- 全部拖拽调用点共用 `usePointerDrag`，不使用 HTML5 Drag & Drop（触屏浏览器不会从触摸生成 dragstart，原生拖拽在移动端完全不工作）：鼠标 / 手写笔位移 > 4px 即起拖，触屏长按 500ms 起拖；长按窗口内先划走则判定为滚动、放行页面
- 命中测试统一为 `document.elementFromPoint(x, y).closest('[data-*]')`，命中属性由调用点指定（图标网格为 `data-icon-id`）；拖拽浮层（ghost）声明 `pointer-events: none`，避免挡住自己正下方的投放目标
- 命中兜底 `hitAreaSelector`：指针在拖拽容器内、却没有压在目标上时（网格列宽由 1fr 均分，图标之间会留下大片空隙），取同一行水平方向最近的目标（拖动源自己除外）——空隙按中点归属相邻图标，于是整个网格都是可操作空间；指针离开容器则命中为 `null`，文件夹的「拖到窗口外 = 移出文件夹」判定依赖这一点
- `onDragMove` 按 rAF 节流；指针贴住滚动容器边缘时自动滚动（原生拖拽自带的能力，改 Pointer Events 后自行补上）；拖拽期间以 `body.is-dragging-active` 全局降低 backdrop-filter，减轻 GPU 压力
- 手势终态三选一：正常投放 `onDragEnd`、触屏「长按起拖后原地松手」`onLongPressTap`（弹操作菜单，同时按「未投放」复位拖拽状态）、异常中断（Esc / pointercancel / 窗口失焦）`onDragCancel`；结束后吞掉紧随其后的 click，避免松手顺带打开图标链接
- 5 处一维列表排序（页面 / 便签 / 搜索源 / Favicon 源 / 笔记管理器）共用 `useListPointerReorder`；落点几何统一走 `utils/dropGeometry.ts`（网格左右各 25% 判 before/after，列表按中线判 before/after）

### 国际化（i18n）
- 文案集中在 `src/i18n/locales/{zh-CN,en-US}/`，两套语言各 16 个命名空间（common / settings / auth / about / weather / todos / notes / search / pages / folder / wallpaper / sites / icons / importExport / dock / system）
- `SUPPORTED_LANGUAGES = ['zh-CN', 'en-US']`，默认 `zh-CN`；语言偏好存于本地 `harborpage_language`
- 语言检测顺序：本地存储 → 浏览器语言 → 默认语言
- 后端 API 仅返回语言无关的错误码与图标源标识（`shared/apiErrors.ts`），前端通过 `translateApiError` / `translateIconSource`（`src/utils/apiErrorUtils.ts`）翻译为当前语言文案

### 状态管理
使用 Zustand 进行全局状态管理，数据持久化到 Cloudflare KV。Store 选择器使用 `useShallow` 避免不必要的重渲染。

### 服务注入
服务通过 `serviceContainer` 动态获取，支持服务替换和测试。

### 数据持久化
- `DataRepository` 作为统一持久化层，禁止直接访问 localStorage
- 认证错误处理集中在 `DataRepository.handleAuthResponse()`
- `DataManager` 使用不可变更新（`this.data = { ...this.data, ... }`）
- localStorage 键统一使用 `harborpage_` 前缀
- 数据加载优先级：先读 localStorage，命中则直接返回不再请求 KV；localStorage 为空才走 Cloudflare KV API
- 持久化追踪键（TRACKED_KEYS）：`settings / websites / searchEngines / todos / todoList / notes / wallpaper / pages / palette / paletteAliases / paletteLightness`
  - `pages` 取代根级 `websites` 作为网站/文件夹的唯一真源，根级 `websites` 在 persist 时被清空
  - `palette` 仅保存用户改过的槽位（≠ 出厂默认 16 色的槽），读取与导入时统一归一化补齐
  - `paletteAliases` 保存槽位别名映射（槽位 ID → 别名），`paletteLightness` 保存全局明暗度（−50~50，不修改已存 hex，仅在使用处叠加亮度）
  - `currentPageId` **不被持久化**，刷新页面永远显示第一页（导入旧数据触发切默认页的特殊路径除外）
- `saveToLocal` 默认 500ms 防抖写 localStorage；关键原子操作（如跨页移动）使用 `DataRepository.flushLocal` 立即写入，避免用户立刻刷新读到旧值

### 图标缓存机制
- 前端通过信号量模式控制并发（3 个并发请求）
- 图标缓存失败后显示 🌐 图标，避免重复请求
- 多源 Fallback：Google → DuckDuckGo → Favicon（默认源顺序由后端 `DEFAULT_FAVICON_SOURCE_CONFIGS` 决定，用户自定义源可覆盖）
- Favicon 源由后端统一管理，前端通过 API 获取

### 图标文件命名规则
- 用户上传图标：`md5("upload_{id}_{timestamp}").png`
- 预览保存图标：`md5("save_{id}_{timestamp}").png`
- 智能获取缓存图标：`md5("cache_{id}_{timestamp}").png`
- 自动 Favicon 缓存：`md5(domain).png`（固定文件名，便于预测）
- R2 存储路径前缀：`WebSites/`、`SearchEngines/`

### 安全规范
- JWT 认证保护所有敏感 API
- 密码 SHA-256 加密传输
- 壁纸代理域名白名单限制
- 请求大小限制（壁纸最大 10MB）
- 敏感变量存储在 `.dev.vars`（本地）或 Cloudflare Secrets（生产）
- 构建产物自动清理 `.dev.vars`（通过 `devVarsCleanup` 插件）

### 性能优化
- 时钟组件使用 ref 直接 DOM 操作，避免每秒触发 React 重渲染
- 图标下载使用信号量并发控制（3 并发）
- URL 输入防抖（3 秒）后更新预览
- 功能面板按需挂载：仅在打开时挂载、关闭后卸载，功能数据的订阅与渲染开销随卸载归零
- `updateEntry` 无变化短路：patch 与当前 entry 逐字段相同时直接返回原 state 引用，阻断功能组件每次重渲染级联带动 FeatureDock / 入口球重渲染
- Store 选择器使用 `useShallow` 减少不必要的重渲染
- `useEffect` 依赖项精确控制，避免循环触发

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT License

## 🙏 致谢

- [React](https://react.dev/)
- [Vite](https://vitejs.dev/)
- [Cloudflare Workers](https://workers.cloudflare.com/)
- [和风天气](https://www.qweather.com/)
- [Open-Meteo](https://open-meteo.com/)
- [Zustand](https://zustand-demo.pmnd.rs/)
- [lunisolar](https://lunisolar.js.org/)
- [qweather-icons](https://github.com/qwd/Icons)
