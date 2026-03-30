# wechat-article-reader

读取微信公众号文章并生成结构化总结的 Claude Code 技能。

A Claude Code skill that reads WeChat Official Account articles and generates structured summaries.

---

## 功能 / Features

- 通过 Chrome CDP 抓取微信公众号文章，绕过反爬限制
- 自动提取标题、作者、公众号名、发布日期、封面图、正文
- 由 Claude 阅读理解后生成结构化总结 Markdown 文件
- 支持 headless/headed/wait 多种浏览器模式，自动应对反爬验证

---

- Fetches WeChat articles via Chrome CDP, bypassing anti-crawling restrictions
- Extracts title, author, account name, publish date, cover image, and full content
- Claude reads and generates a structured summary Markdown file
- Supports headless/headed/wait browser modes with automatic anti-crawl fallback

## 安装 / Installation

### 前置要求 / Prerequisites

- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) CLI
- Google Chrome 浏览器
- [Bun](https://bun.sh/) 或 Node.js (npx)

### 安装步骤 / Steps

1. 将 `wechat-article-reader` 文件夹复制到 `~/.claude/skills/` 目录下：

   Copy the `wechat-article-reader` folder to `~/.claude/skills/`:

   ```bash
   cp -r wechat-article-reader ~/.claude/skills/
   ```

2. 安装依赖 / Install dependencies:

   ```bash
   cd ~/.claude/skills/wechat-article-reader/scripts
   npm install
   ```

3. 重启 Claude Code，技能会被自动识别。

   Restart Claude Code. The skill will be automatically detected.

## 使用 / Usage

在 Claude Code 中直接提供微信公众号文章链接即可：

Simply provide a WeChat article URL in Claude Code:

```
帮我读一下这篇文章 https://mp.weixin.qq.com/s/xxxxx
```

或者 / Or:

```
总结这篇微信文章 https://mp.weixin.qq.com/s/xxxxx
```

Claude 会自动：
1. 抓取文章内容
2. 阅读理解
3. 生成总结文件到 `~/Downloads/wechat-articles/`
4. 在终端展示摘要和核心观点

---

Claude will automatically:
1. Fetch the article content
2. Read and understand it
3. Generate a summary file to `~/Downloads/wechat-articles/`
4. Display the summary and key points in the terminal

## 总结文件格式 / Summary Format

```markdown
---
title: "文章标题"
author: "作者"
account: "公众号名称"
publish_date: "发布日期"
source_url: "原始链接"
summarized_at: "总结时间"
---

# 文章标题

## 一句话摘要
...

## 核心观点
- ...

## 详细总结
...

## 关键数据与引用
- ...
```

## CLI 选项 / CLI Options

脚本也可以独立使用 / The script can also be used standalone:

```bash
bun ~/.claude/skills/wechat-article-reader/scripts/main.ts <url> [options]
```

| 选项 / Option | 说明 / Description |
|---|---|
| `<url>` | 微信公众号文章 URL (required) |
| `--browser auto\|headless\|headed` | 浏览器模式 / Browser mode (default: auto) |
| `--wait` | 等待用户手动信号 / Wait for user signal |
| `--timeout <ms>` | 页面超时 / Page timeout (default: 30000) |

## 环境变量 / Environment Variables

| 变量 / Variable | 说明 / Description |
|---|---|
| `WECHAT_CHROME_PATH` | 自定义 Chrome 路径 / Custom Chrome path |
| `WECHAT_CHROME_PROFILE_DIR` | 自定义 Chrome Profile 目录 / Custom Chrome profile dir |

## 目录结构 / Structure

```
wechat-article-reader/
├── SKILL.md              # 技能定义 / Skill definition
├── README.md             # 本文件 / This file
└── scripts/
    ├── main.ts           # 核心脚本 / Core script
    └── package.json      # 依赖 / Dependencies
```

## 许可 / License

MIT
