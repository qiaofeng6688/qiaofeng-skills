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

## 许可

MIT
