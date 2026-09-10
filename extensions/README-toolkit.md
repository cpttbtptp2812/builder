# 前端联调工具包

> **重要：不要直接选 zip 文件加载！**  
> Chrome 会报错 `Could not unzip extension for install`。  
> 请先把 zip **解压到文件夹**，再加载该文件夹（根目录要有 `manifest.json`）。

一个 Chrome 扩展，包含 ClipHub / Env / Wire 三个面板。数据都在本地，不联网也能用。

## 安装

1. **右键 zip → 解压到当前文件夹**
2. 打开 `chrome://extensions`，右上角开启 **开发者模式**
3. 点 **「加载已解压的扩展程序」**
4. 选解压后的文件夹（根目录有 `manifest.json`）— **只需加载一次**
5. 刷新你要调试的网页，点工具栏图标切换 ClipHub / Env / Wire

## 三个面板干什么

| 面板 | 用途 |
|------|------|
| **ClipHub** | 选中文字 → 右键保存 → 下次从列表跳回原处高亮 |
| **Env** | 按域名切 API / Token，刷新页面即生效 |
| **Wire** | 看页面里 EventSource（SSE）每一帧 OPEN / MESSAGE / ERROR |

## 常见用法

- **联调后端**：Env 给测试域名配 API Base + Bearer，Wire 看流式接口有没有断
- **读文档 / 查 bug**：ClipHub 标记原文位置，改代码时跳回去对照
- **AI 对话页**：Wire 比 Network 更直观看 SSE 帧

## 说明

- 仍提供 ClipHub / Env / Wire 单独 zip，可按需只装其中一个
- 更新时重新下载 zip，在扩展页点刷新即可
