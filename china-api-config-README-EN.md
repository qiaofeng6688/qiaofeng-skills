# china-api-config

A Claude Code skill that automatically detects the region of Chinese AI provider API keys and configures the correct API endpoints.

## The Problem

Many Chinese AI providers operate separate **China mainland** and **international** platforms with different API endpoints. API keys are region-bound and not interchangeable.

Using the wrong endpoint results in a misleading `invalid api key` error — not a clear region mismatch message. This leads to frustrating debugging: checking if the key is correct, expired, or lacks permissions — when the real issue is simply an **endpoint mismatch**.

This skill makes Claude Code automatically run through a region verification flow when configuring Chinese AI providers, catching this issue upfront.

## Supported Providers

| Type | Providers | Notes |
|------|-----------|-------|
| **Dual-region endpoints** | MiniMax, DashScope (Alibaba Cloud), Zhipu AI, Moonshot | Must confirm region, different endpoints |
| **Global unified endpoint** | DeepSeek, Stepfun, SiliconFlow | No region distinction needed |
| **China mainland only** | Baidu Qianfan, Volcano Engine (Doubao), iFlytek Spark | Fixed endpoints |

### Endpoint Quick Reference

<details>
<summary>Click to expand full endpoint table</summary>

#### MiniMax

| | China Mainland | International |
|--|----------------|---------------|
| API | `https://api.minimaxi.com` | `https://api.minimax.io` |
| Platform | `https://platform.minimaxi.com` | `https://platform.minimax.io` |

> Note the extra `i` in the China mainland domain: minimax**i**.com

#### DashScope (Alibaba Cloud / Tongyi / Bailian)

| Region | API Base URL |
|--------|-------------|
| China Mainland (Beijing) | `https://dashscope.aliyuncs.com/compatible-mode/v1` |
| International (Singapore) | `https://dashscope-intl.aliyuncs.com/compatible-mode/v1` |
| Hong Kong | `https://cn-hongkong.dashscope.aliyuncs.com/compatible-mode/v1` |
| US (Virginia) | `https://dashscope-us.aliyuncs.com/compatible-mode/v1` |

> Four independent regions — keys are not interchangeable across regions

#### Zhipu AI (ZhipuAI / GLM)

| | China Mainland | International (Z.AI) |
|--|----------------|----------------------|
| API | `https://open.bigmodel.cn/api/paas/v4` | `https://api.z.ai/api/paas/v4` |
| Platform | `https://open.bigmodel.cn` | `https://www.zhipuai.cn` |

#### Moonshot / Kimi

| | China Mainland | International |
|--|----------------|---------------|
| API | `https://api.moonshot.cn/v1` | `https://api.moonshot.ai/v1` |
| Platform | `https://platform.moonshot.cn` | `https://platform.moonshot.ai` |

#### DeepSeek

| API | `https://api.deepseek.com` |
|-----|---------------------------|

#### Stepfun

| API | `https://api.stepfun.com/v1` |
|-----|------------------------------|

#### SiliconFlow

| API | `https://api.siliconflow.cn/v1` |
|-----|---------------------------------|

#### Baidu Qianfan (ERNIE)

| API | `https://qianfan.baidubce.com/v2` |
|-----|-----------------------------------|

> Uses AK/SK pair authentication, not a single API key

#### Volcano Engine (Doubao)

| API | `https://ark.cn-beijing.volces.com/api/v3` |
|-----|---------------------------------------------|

#### iFlytek Spark

| OpenAI-compatible | `https://maas-api.cn-huabei-1.xf-yun.com/v1` |
|-------------------|------------------------------------------------|

> Authentication requires three credentials: APP_ID + API_KEY + API_SECRET

</details>

## API Key Format Identification

| Pattern | Likely Provider |
|---------|-----------------|
| `sk-cp-...` | MiniMax Token Plan |
| `sk-...` | MiniMax, DashScope, Moonshot, DeepSeek, SiliconFlow, etc. |
| Contains `.` separator (`{id}.{secret}`) | Zhipu AI |
| UUID format | Volcano Engine |
| AK/SK pair | Baidu Qianfan |
| APP_ID + KEY + SECRET | iFlytek Spark |

## Installation

### Option 1: Install via .skill file

Download [china-api-config.skill]([china-api-config](https://github.com/qiaofeng6688/qiaofeng-skills/tree/4e5e66f1a936a78563ee5bbf8c3485c612bfd516/china-api-config)), then in Claude Code:

```
/install-skill china-api-config.skill
```

### Option 2: Manual installation

Copy the `china-api-config` directory to Claude Code's skills directory:

```bash
# User-level (available across all projects)
cp -r china-api-config ~/.claude/skills/

# Project-level (current project only)
cp -r china-api-config .claude/skills/
```

## Skill Structure

```
china-api-config/
├── SKILL.md                     # Configuration flow and decision logic
└── references/
    └── providers.md             # Endpoint details, key formats, and env vars for 10 providers
```

## How It Works

When you configure a Chinese AI provider's API in Claude Code, this skill automatically triggers and guides you through:

1. **Identify provider** — from key format, provider name, or error message
2. **Determine region type** — dual-region, global unified, or China-only
3. **Confirm key origin** — ask which platform the key was obtained from
4. **Configure endpoint** — set the correct `BASE_URL`
5. **Verify connection** — test API call to confirm the configuration

## Common Pitfalls

- **MiniMax domain confusion**: `minimaxi.com` (China) vs `minimax.io` (international) — just one letter `i` apart
- **DashScope has four regions**: not just "China vs international" — Beijing, Singapore, Hong Kong, and US are all independent
- **Baidu and iFlytek authentication**: not a single API key — requires multiple credentials
- **SiliconFlow domain migration**: `.com` is retired, use `.cn`
- **Token Plan vs pay-as-you-go**: different billing plans from the same provider may use incompatible keys

## License

MIT
