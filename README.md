# qiaofeng-skills
some personal claude code skills, including Chinese models config method ,and something interesting...

# china-api-config

Claude Code 技能：自动识别中国 AI 服务商 API Key 的区域版本，配置正确的 API 端点。

## 解决什么问题

许多中国 AI 服务商同时运营**中国大陆版**和**国际版**平台，它们使用不同的 API 端点，且 API Key 与区域绑定、不可互换。

用错端点只会得到一个令人困惑的 `invalid api key` 错误，而不是明确的区域提示。这导致你反复检查 Key 是否正确、是否过期、是否有权限——但真正的问题只是**端点不匹配**。

这个技能让 Claude Code 在配置中国 AI 服务商时，自动走一遍区域确认流程，第一时间避开这个坑。

## 覆盖服务商

| 类型 | 服务商 | 说明 |
|------|--------|------|
| **双区域端点** | MiniMax、DashScope（阿里云）、智谱AI、Moonshot | 必须确认区域，端点不同 |
| **全球统一端点** | DeepSeek、Stepfun、SiliconFlow | 无需区分区域 |
| **仅中国大陆** | 百度千帆、火山引擎（豆包）、讯飞星火 | 固定端点 |

### 端点速查

<details>
<summary>点击展开完整端点表</summary>

#### MiniMax

| | 中国大陆 | 国际版 |
|--|----------|--------|
| API | `https://api.minimaxi.com` | `https://api.minimax.io` |
| 平台 | `https://platform.minimaxi.com` | `https://platform.minimax.io` |

> 注意大陆版域名多了一个 `i`：minimax**i**.com

#### DashScope（阿里云通义/百炼）

| 区域 | API Base URL |
|------|-------------|
| 中国大陆（北京） | `https://dashscope.aliyuncs.com/compatible-mode/v1` |
| 国际（新加坡） | `https://dashscope-intl.aliyuncs.com/compatible-mode/v1` |
| 香港 | `https://cn-hongkong.dashscope.aliyuncs.com/compatible-mode/v1` |
| 美国 | `https://dashscope-us.aliyuncs.com/compatible-mode/v1` |

> 四个区域的 Key 各自独立，互不通用

#### 智谱AI (ZhipuAI / GLM)

| | 中国大陆 | 国际版 (Z.AI) |
|--|----------|---------------|
| API | `https://open.bigmodel.cn/api/paas/v4` | `https://api.z.ai/api/paas/v4` |
| 平台 | `https://open.bigmodel.cn` | `https://www.zhipuai.cn` |

#### Moonshot / Kimi

| | 中国大陆 | 国际版 |
|--|----------|--------|
| API | `https://api.moonshot.cn/v1` | `https://api.moonshot.ai/v1` |
| 平台 | `https://platform.moonshot.cn` | `https://platform.moonshot.ai` |

#### DeepSeek

| API | `https://api.deepseek.com` |
|-----|---------------------------|

#### Stepfun（阶跃星辰）

| API | `https://api.stepfun.com/v1` |
|-----|------------------------------|

#### SiliconFlow（硅基流动）

| API | `https://api.siliconflow.cn/v1` |
|-----|---------------------------------|

#### 百度千帆

| API | `https://qianfan.baidubce.com/v2` |
|-----|-----------------------------------|

> 认证方式为 AK/SK 对，非单一 API Key

#### 火山引擎（豆包）

| API | `https://ark.cn-beijing.volces.com/api/v3` |
|-----|---------------------------------------------|

#### 讯飞星火

| OpenAI 兼容 | `https://maas-api.cn-huabei-1.xf-yun.com/v1` |
|-------------|------------------------------------------------|

> 认证需要三元组：APP_ID + API_KEY + API_SECRET

</details>

## API Key 格式识别

| 特征 | 可能的服务商 |
|------|-------------|
| `sk-cp-...` | MiniMax Token Plan |
| `sk-...` | MiniMax、DashScope、Moonshot、DeepSeek、SiliconFlow 等 |
| 含 `.` 分隔符（`{id}.{secret}`） | 智谱AI |
| UUID 格式 | 火山引擎 |
| AK/SK 对 | 百度千帆 |
| APP_ID + KEY + SECRET | 讯飞星火 |

## 安装

### 方式一：通过 .skill 文件安装

下载 [china-api-config.skill](https://github.com/qiaofeng6688/qiaofeng-skills/china-api-config/releases) 文件，然后在 Claude Code 中：

```
/install-skill china-api-config.skill
```

### 方式二：手动安装

将 `china-api-config` 目录复制到 Claude Code 的技能目录：

```bash
# 用户级安装（所有项目可用）
cp -r china-api-config ~/.claude/skills/

# 项目级安装（仅当前项目）
cp -r china-api-config .claude/skills/
```

## 技能结构

```
china-api-config/
├── SKILL.md                     # 配置流程和决策逻辑
└── references/
    └── providers.md             # 10 家服务商的端点、Key 格式、环境变量详情
```

## 工作原理

当你在 Claude Code 中配置中国 AI 服务商的 API 时，这个技能会自动触发并引导完成以下流程：

1. **识别服务商** — 从 Key 格式、服务商名称或报错信息判断
2. **判断区域类型** — 确认是双区域、全球统一还是仅中国大陆
3. **确认 Key 来源** — 询问你从哪个平台获取的 Key
4. **配置端点** — 自动设置正确的 `BASE_URL`
5. **验证连接** — 测试 API 调用确认配置正确

## 常见陷阱

- **MiniMax 域名混淆**：`minimaxi.com`（大陆）vs `minimax.io`（国际），只差一个字母 `i`
- **DashScope 四区域**：不止"中国 vs 国际"，北京/新加坡/香港/美国各自独立
- **百度和讯飞的认证体系**：不是单一 API Key，需要多个凭证配合
- **SiliconFlow 域名迁移**：`.com` 已退役，需使用 `.cn`
- **Token Plan vs 按量付费**：同一服务商的不同计费方式，Key 可能不可互换

---
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

## 许可

MIT
