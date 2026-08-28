# 王旭 · 前端技术作品集

**个人技术展示站**，适合放入简历链接。首页展示 10 年开发经历与代表项目，内置可交互 **AI 产品演示**（对齐 `agent` + `imean-ai` 架构）。

| 模块 | 说明 |
|------|------|
| 作品集首页 | 关于、项目、技能、经历、联系方式 |
| 交互演示 | 流式对话、工作流匹配、执行进度、工具卡、智能体 |

纯前端 + 浏览器存储，支持 **GitHub Pages** 与 **百度智能云 BOS** 静态托管。

## 在线访问

推送 `main` 分支后自动部署：

**https://cpttbtptp2812.github.io/builder/**

## 开发

```bash
git clone https://github.com/cpttbtptp2812/builder.git
cd builder
npm install
npm run dev
```

打开 `http://localhost:5173` → 浏览作品集 → 点击 **交互演示** 进入 `#/demo/chat`。

## GitHub Pages

仓库已配置 Actions 工作流（`.github/workflows/static.yml`）：

1. push 到 `main` 后自动 `npm ci && npm run build`
2. 部署 `dist/` 到 Pages（Node 24）
3. 首次若仍失败，到仓库 **Settings → Pages → Build and deployment** 确认 Source 为 **GitHub Actions**

本地模拟 Pages 构建：

```bash
# PowerShell
$env:GITHUB_PAGES="true"; npm run build; npm run preview
```

## 构建 & 发布到百度

```bash
npm run build
```

（不要设置 `GITHUB_PAGES`，默认 `base: './'` 适用于 BOS 根目录）

### 1. 上传 BOS

1. 登录 [百度智能云控制台](https://cloud.baidu.com/) → **对象存储 BOS** → 创建 Bucket（**公有读**）。
2. **Bucket 配置 → 静态网站托管**：
   - 索引文档：`index.html`
   - 错误文档：`index.html`（Hash 路由必须）
3. 将 `dist/` 内**全部文件**上传到 Bucket 根目录。

### 2. SEO 与百度收录

发布前请替换占位域名：

| 文件 | 操作 |
|------|------|
| `public/robots.txt` | 将 `YOUR_DOMAIN` 改为你的域名 |
| `public/sitemap.xml` | 同上 |
| `index.html` | 取消注释 `baidu-site-verification`，填入站长验证码 |

然后在 [百度搜索资源平台](https://ziyuan.baidu.com/)：

1. 添加站点并验证所有权
2. 提交 sitemap：`https://你的域名/sitemap.xml`
3. 使用「链接提交」主动推送首页 URL

### 3. 自定义域名（可选）

在 BOS 绑定域名并完成备案后，将上述文件中的 `YOUR_DOMAIN` 全部替换为正式域名。

## 页面路由

| 路由 | 功能 |
|------|------|
| `/` | 作品集首页（简历展示） |
| `#/demo/chat` | 对话 + 工作流卡 + 进度 + 工具卡 |
| `#/demo/agents` | 智能体列表 |
| `#/demo/workflows` | 工作流频道库 |
| `#/demo/history` | 会话历史 |
| `#/demo/features` | 与 agent / imean-ai 的能力对照 |

## 试玩提示词

- `帮我找一个自动化工作流`
- `查一下知识库文档`

## 参考仓库

| 仓库 | 本站点复现 |
|------|-----------|
| `tianyangAgent/agent` | 流式对话、智能体、历史、工具卡 |
| `tianyang/imean-ai` | 工作流匹配、频道库、执行进度、评价 |

完整线上能力需部署 `agent` Next 应用及 iMean 后端；本站点为**静态可部署**的技术展示与 UI 演示。
