# Manggo 百炼翻译与 OCR 插件

[![CI](https://github.com/SchweppesSoda/manggo-bailian-plugin/actions/workflows/ci.yml/badge.svg)](https://github.com/SchweppesSoda/manggo-bailian-plugin/actions/workflows/ci.yml)

一个 Manggo 原生插件，在同一个 `.mplugin` 中提供阿里云百炼文本翻译和截图 OCR。支持三种相互隔离的计费模式：

- 按量付费（公开版默认，适合自定义应用）
- Coding Plan
- Token Plan

所有请求都由 Manggo 本地插件运行时使用用户自己的 API Key 直连阿里云；本项目不提供中转服务，也不收集文本、截图或凭据。

## 安装

1. 从 [Releases](https://github.com/SchweppesSoda/manggo-bailian-plugin/releases/latest) 下载最新 `.mplugin`。
2. 在 Manggo 的“插件管理”页面安装。
3. 分别在翻译服务和 OCR 服务设置中添加“百炼翻译”和“百炼 OCR”。
4. 选择计费模式、地域和模型，填写该模式对应的 API Key。

Manggo 的服务配置彼此隔离，因此翻译和 OCR 使用同一个 Key 时也需要分别填写。

## 三种计费模式

| 模式 | 自动使用的 OpenAI 兼容 Base URL | Key | 建议模型 |
|---|---|---|---|
| 按量付费·中国 | `https://dashscope.aliyuncs.com/compatible-mode/v1` | 对应地域的通用 Key | 通用 `qwen3.7-plus`；翻译可选 `qwen-mt-plus`；OCR 可选 `qwen3.5-ocr` |
| 按量付费·新加坡 | `https://dashscope-intl.aliyuncs.com/compatible-mode/v1` | 新加坡地域通用 Key | 以该地域实际可用模型为准 |
| Coding Plan | `https://coding.dashscope.aliyuncs.com/v1` | Coding Plan 专属 Key | `qwen3.7-plus` |
| Token Plan | `https://token-plan.cn-beijing.maas.aliyuncs.com/compatible-mode/v1` | Token Plan 专属 Key | `qwen3.7-plus` |

三种模式的 API Key 与 Base URL 必须配套，Coding Plan 与 Token Plan 即使 Key 前缀相同也不能互换。插件不会根据 Key 前缀猜测线路。

按量付费可以填写 `Workspace ID`，插件会构造阿里云推荐的 Workspace 专属域名。其他地域、未来套餐地址或私有兼容端点可填写 `Custom Base URL`；该字段优先级最高且仅接受 HTTPS。

### Coding Plan 与 Token Plan 使用边界

阿里云官方将 Coding Plan 和 Token Plan 限定为符合条件的交互式 AI 工具使用，禁止共享后端、自动化脚本和非交互式批量调用。安装此插件不会自动获得套餐使用资格；请根据当前服务条款自行确认 Manggo 场景是否在允许范围内。公开使用时优先选择按量付费。

## 模型与请求行为

- `qwen3.7-plus`：三种模式共同可用的默认模型，支持文本和图片。
- `qwen-mt-plus`：仅按量付费；插件发送官方要求的 `translation_options`。由于该模型的流式响应可能返回累计序列，插件会自动使用非流式响应。
- `qwen3.5-ocr`：仅按量付费的 OCR 预置模型。
- 模型下拉框允许自定义值，但最终可用性取决于计费模式、地域和阿里云当前模型清单。

### 思考模式

思考默认关闭。开启后可选择：

| Reasoning effort | 行为 |
|---|---|
| Automatic | 不指定预算，使用模型默认值 |
| Low | 最多 4,096 个思考 Token |
| Medium | 最多 16,384 个思考 Token |
| High | 使用插件记录的模型官方上限 |

Qwen 3.5–3.7、Kimi 和 GLM 使用 `enable_thinking` 与 `thinking_budget`；Qwen 3.8 Max 使用其原生 `reasoning_effort`。推理内容不会进入译文或 OCR 结果。Qwen Coder、Qwen MT 和 Qwen 3.5 OCR 不支持在本插件中开启思考；MiniMax M2.5 为仅思考模型。

普通翻译和清晰截图 OCR 建议关闭思考，以减少延迟和额度消耗。

## 配置字段

| 字段 | 默认值 | 说明 |
|---|---|---|
| Billing mode | Pay-as-you-go | 选择按量付费、Coding Plan 或 Token Plan |
| Region | China (Beijing) | 新加坡只用于按量付费 |
| Workspace ID | 空 | 按量付费可选，构造 Workspace 专属域名 |
| Custom Base URL | 空 | HTTPS 高级覆盖项，优先级最高 |
| Model | `qwen3.7-plus` | 可从预置列表选择或输入自定义模型 ID |
| Max tokens | 翻译 4096 / OCR 8192 | 结果被截断时调大 |
| Stream result | 开启 | 逐步显示支持增量流的模型结果 |
| Enable thinking | 关闭 | 需要复杂推理时才开启 |
| Reasoning effort | Automatic | 仅在开启思考后生效 |

## 错误排查

- `400`：检查模型是否属于所选计费模式，并检查思考设置。
- `401`：检查 API Key、计费模式、地域和 Base URL 是否配套。
- `403`：所选模型或客户端场景可能没有权限。
- `429`：达到套餐额度或模型速率限制，稍后重试。
- `output was truncated`：调大 Max tokens，或缩短输入内容。

插件不会自动重试，以免额外消耗调用次数或 Credits。API Key 只应填入 Manggo 密码框，不要写进源码、Issue、截图或日志。

## 开发与打包

项目无第三方运行依赖。Manggo 使用 Bun 运行插件，本地测试使用 Node.js 内置测试框架。

```powershell
node --test
pwsh -NoProfile -File scripts/package.ps1
```

`.mplugin` 本质是 ZIP，包根目录包含：

```text
manggo.plugin.json
main.js
README.md
LICENSE
icon.png
```

## 参考

- [Manggo 原生插件开发指南](https://github.com/Pylogmon/manggo-plugin)
- [百炼 Base URL 总览](https://help.aliyun.com/zh/model-studio/base-url)
- [百炼 OpenAI Chat Completions](https://help.aliyun.com/zh/model-studio/qwen-api-via-openai-chat-completions)
- [Coding Plan](https://help.aliyun.com/zh/model-studio/coding-plan)
- [Token Plan 个人版](https://help.aliyun.com/zh/model-studio/token-plan-personal-overview)
- [Qwen-MT API](https://help.aliyun.com/zh/model-studio/qwen-mt-api)
- [Qwen-OCR API](https://help.aliyun.com/zh/model-studio/qwen-vl-ocr-api-reference)

本项目与阿里云、百炼及 Manggo 官方均无隶属或合作关系。“阿里云”“百炼”及相关模型名称属于各自权利人。项目图标为本仓库原创资产，不使用阿里云官方产品图标。

## License

[MIT](LICENSE)
