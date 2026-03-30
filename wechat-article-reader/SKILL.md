---
name: wechat-article-reader
description: 读取微信公众号文章并生成结构化总结。当用户提供 mp.weixin.qq.com 链接，或提到"读一下公众号文章"、"总结微信文章"、"公众号文章摘要"、"帮我看看这个微信文章"时触发。
---

# 微信公众号文章阅读与总结

读取微信公众号文章，提取内容后生成结构化总结文档。

## 脚本目录

脚本位于本技能的 `scripts/` 子目录中。

**执行方式**:
1. 确定本 SKILL.md 文件的目录路径为 `{baseDir}`
2. 脚本路径 = `{baseDir}/scripts/main.ts`
3. 运行时解析: 如果 `bun` 已安装 → 使用 `bun`；如果 `npx` 可用 → 使用 `npx -y bun`；否则提示安装 bun

## 使用流程

当用户提供微信公众号文章链接时，按以下步骤执行：

### 第一步：抓取文章

```bash
${BUN_X} {baseDir}/scripts/main.ts <url>
```

脚本通过 Chrome CDP 抓取文章，输出 JSON 数据（在 `---JSON_START---` 和 `---JSON_END---` 标记之间）。

### 第二步：解析 JSON

从脚本输出中提取 `---JSON_START---` 和 `---JSON_END---` 之间的 JSON 数据。

| 字段 | 说明 |
|------|------|
| `title` | 文章标题 |
| `author` | 作者 |
| `account` | 公众号名称 |
| `publishDate` | 发布日期 |
| `coverImage` | 封面图 URL |
| `content` | 正文内容（保留基本 Markdown 格式） |
| `url` | 原始链接 |

如果 JSON 中包含 `error` 字段，说明抓取失败，向用户报告错误。

### 第三步：生成总结

阅读理解 `content` 字段的文章内容，生成以下结构的 Markdown 文件：

```markdown
---
title: "{title}"
author: "{author}"
account: "{account}"
publish_date: "{publishDate}"
source_url: "{url}"
summarized_at: "{当前 ISO 时间}"
---

# {title}

## 一句话摘要
用一句话概括文章的核心内容。

## 核心观点
- 观点1
- 观点2
- ...

## 详细总结
按文章逻辑结构，分段总结主要内容。保留关键论据和推理过程。

## 关键数据与引用
- 文章中出现的重要数据、图表结论、引用来源等
```

### 第四步：保存文件

- 保存路径: `~/Downloads/wechat-articles/{slug}.md`
- slug: 从文章标题生成，去除特殊字符
- 如果文件已存在，追加时间戳 `-YYYYMMDD-HHMMSS`
- 确保 `~/Downloads/wechat-articles/` 目录存在

### 第五步：向用户展示结果

在终端输出：
1. 一句话摘要
2. 核心观点列表
3. 文件保存路径

## 行为约束

- 总结必须忠实于原文，不添加原文没有的观点
- 使用中文输出
- 不遗漏文章中的关键数据和重要引用

## 错误处理

| 错误类型 | 处理方式 |
|----------|----------|
| 非微信链接 | 脚本直接拒绝，提示仅支持 mp.weixin.qq.com |
| 反爬验证 (ANTI_CRAWL) | 脚本自动切换到可见浏览器 + 等待模式，提示用户完成验证 |
| 正文为空 | 提示文章可能已被删除或需要登录 |
| Chrome 未安装 | 提示设置 WECHAT_CHROME_PATH 环境变量 |

## CLI 选项

| 选项 | 说明 |
|------|------|
| `<url>` | 微信公众号文章 URL（必需） |
| `--browser <mode>` | 浏览器模式: `auto`(默认), `headless`, `headed` |
| `--wait` | 等待用户手动信号后再抓取 |
| `--timeout <ms>` | 页面加载超时（默认 30000） |

## 环境变量

| 变量 | 说明 |
|------|------|
| `WECHAT_CHROME_PATH` | 自定义 Chrome 可执行文件路径 |
| `WECHAT_CHROME_PROFILE_DIR` | 自定义 Chrome Profile 目录 |
