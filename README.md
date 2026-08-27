# 百炼翻译与 OCR：Manggo + Bob 插件

[![CI](https://github.com/SchweppesSoda/manggo-bailian-plugin/actions/workflows/ci.yml/badge.svg)](https://github.com/SchweppesSoda/manggo-bailian-plugin/actions/workflows/ci.yml)

一个源码仓库，同时构建三个原生安装包：

| 平台 | 安装包 | 能力 |
|---|---|---|
| Manggo | `manggo-bailian-2.1.0.mplugin` | 翻译 + OCR |
| Bob 1.8+ | `bob-bailian-translate-2.1.0.bobplugin` | 流式文本翻译 |
| Bob 1.8+ | `bob-bailian-ocr-2.1.0.bobplugin` | 图片 OCR |

三个包共享同一套阿里云百炼路由、模型思考规则、请求体、响应解析和错误脱敏逻辑，但分别使用 Manggo Bun 与 Bob JavaScriptCore 的原生网络接口。所有请求都在本地插件运行时使用用户自己的 API Key 直连百炼；本项目不提供中转服务，也不收集文本、图片或凭据。

> Bob 状态：代码、模拟宿主测试和安装包结构检查已完成；在 macOS Bob 真机完成安装、流式取消和 OCR 图片上传测试前，Bob 包只作为 Beta 预发布，不提交 Bob 官方插件索引。

## 下载与安装

从 [Releases](https://github.com/SchweppesSoda/manggo-bailian-plugin/releases) 下载与你的平台相符的文件。

### Manggo

安装 `.mplugin` 后，分别添加“百炼翻译”和“百炼 OCR”服务。Manggo 的服务配置相互隔离；两个服务使用同一个 Key 时，也需要分别填写。

### Bob

翻译和 OCR 是两个独立 `.bobplugin`，按需双击安装。两者的设置也相互独立，需要分别选择计费模式、模型并填写 API Key。

Bob 插件使用 secure 类型保存 API Key。配置校验只做本地检查，不发送模型请求，也不产生调用费用。

## 三种百炼计费模式

| 模式 | 自动 Base URL | Key 与建议模型 |
|---|---|---|
| 按量付费·中国 | `https://dashscope.aliyuncs.com/compatible-mode/v1` | 中国地域通用 Key；默认 `qwen3.7-plus`，翻译可选 `qwen-mt-plus`，OCR 可选 `qwen3.5-ocr` |
| 按量付费·新加坡 | `https://dashscope-intl.aliyuncs.com/compatible-mode/v1` | 新加坡地域通用 Key；模型以该地域实际清单为准 |
| Coding Plan | `https://coding.dashscope.aliyuncs.com/v1` | Coding Plan 专属 Key；建议 `qwen3.7-plus` |
| Token Plan | `https://token-plan.cn-beijing.maas.aliyuncs.com/compatible-mode/v1` | Token Plan 专属 Key；建议 `qwen3.7-plus` |

API Key 与 Base URL 必须属于同一模式和地域。插件不会根据 Key 前缀猜测线路。

按量付费可填写 `Workspace ID`，插件会构造 Workspace 专属地址。`Custom Base URL` 是最高优先级的高级覆盖项，只接受 HTTPS；使用它意味着 API Key 会发送到你填写的地址，请只使用可信端点。

### Coding Plan 与 Token Plan 边界

阿里云将 Coding Plan 和 Token Plan 限定为符合条件的交互式 AI 工具使用，禁止共享后端、自动化脚本和非交互式批量调用。安装本插件不会自动获得套餐资格；请按当前服务条款自行确认使用场景。公开或不确定的场景优先使用按量付费。

## 模型、翻译与 OCR 行为

- `qwen3.7-plus` 是三种模式共同适用的默认模型，支持文本和图片。
- `qwen-mt-plus` 只用于按量付费翻译。插件按官方格式发送英文完整语言名，并固定使用非流式请求，避免累计流式序列被重复拼接。
- `qwen3.5-ocr` 是按量付费 OCR 专用预置；请求使用该模型要求的 user-only 消息结构。
- Bob 翻译使用 `$http.streamRequest`，向 Bob 发送累计全文，并支持 `cancelSignal`。
- Bob OCR 固定非流式，把识别结果转换为 Bob 的逐行 `texts`。首版不提供文字坐标或 Bounding Box。
- 自定义模型最终是否可用，取决于所选模式、地域和百炼当前模型清单。

## 思考强度

思考默认关闭，以减少延迟和额度消耗。开启后可选择：

| 选项 | 行为 |
|---|---|
| Automatic | 不指定预算，使用模型默认值 |
| Low | 最多 4,096 个思考 Token |
| Medium | 最多 16,384 个思考 Token |
| High | 使用插件内记录的该模型官方上限 |

Qwen 3.5–3.7、Kimi 和 GLM 使用 `enable_thinking` 与 `thinking_budget`；Qwen 3.8 Max 使用原生 `reasoning_effort`。推理内容不会进入译文或 OCR 结果。

Bob 的设置控件不支持条件隐藏，因此 `Reasoning effort` 菜单会一直显示，但只在 `Enable thinking = On` 且模型支持可调强度时生效。不支持的模型会给出明确错误：

- Qwen Coder、Qwen MT、Qwen 3.5 OCR：不支持插件内可选思考。
- MiniMax M2.5：仅思考模型，需开启思考，但强度保持 Automatic。
- 未登记的自定义模型：思考关闭时允许调用；开启思考时安全拒绝，避免发送错误参数。

普通翻译和清晰截图 OCR 建议保持关闭。

## 开发与打包

运行时没有第三方依赖；开发构建使用锁定版本的 esbuild，测试使用 Node.js 内置测试框架。

```powershell
npm ci
npm run build
npm test
npm run package
```

输出位于 `dist/`：三个插件安装包和 `SHA256SUMS.txt`。打包脚本会验证：

- 三个平台版本号一致；
- ZIP 根目录包含各平台要求的 manifest 和入口文件；
- Bob 包不含 ESM、Node 或浏览器专属运行时调用；
- 包内不含本机用户路径或疑似真实 API Key。

源码边界：

```text
src/core/              纯数据 Core，不访问任何平台运行时
src/manggo/            Manggo Bun 入口与网络适配
src/bob/common/        Bob 翻译公共适配
src/bob/translate/     Bob 翻译入口
src/bob/ocr/           Bob OCR 图片与结果适配
platforms/bob-*/       两个 Bob 包的独立 manifest 和生成产物
```

## Bob 发布结构

一个 Bob `info.json` 只能声明一个 `category`，根 `appcast.json` 也只能对应一个插件标识。因此本仓库负责全部源码和构建；真机验证通过后，翻译与 OCR 将分别同步到两个只负责发布和索引的薄仓库：

- `SchweppesSoda/bob-bailian-translate`
- `SchweppesSoda/bob-bailian-ocr`

两个发布仓库将各自维护根 `appcast.json` 和 `bobplugin` Topic，使 Bob 能把它们索引成两张独立插件卡片。真机验证前不会创建稳定 appcast 或提交官方索引。

## 错误排查

- `400`：检查模型、思考设置和请求参数。
- `401`：检查 API Key、计费模式、地域和 Base URL 是否配套。
- `403`：所选模型或客户端场景可能没有权限。
- `429`：达到套餐额度或模型速率限制，稍后重试。
- `output was truncated`：调大 Max tokens，或缩短输入内容。

插件不会自动重试，以免额外消耗调用次数或 Credits。不要把 API Key 写进源码、Issue、截图或日志。

## 参考

- [Manggo 原生插件开发指南](https://github.com/Pylogmon/manggo-plugin)
- [Bob 插件开发文档](https://bobtranslate.com/plugin/)
- [百炼 Base URL 总览](https://help.aliyun.com/zh/model-studio/base-url)
- [百炼 OpenAI Chat Completions](https://help.aliyun.com/zh/model-studio/qwen-api-via-openai-chat-completions)
- [Coding Plan](https://help.aliyun.com/zh/model-studio/coding-plan)
- [Token Plan 个人版](https://help.aliyun.com/zh/model-studio/token-plan-personal-overview)
- [Qwen-MT API](https://help.aliyun.com/zh/model-studio/qwen-mt-api)
- [Qwen-OCR API](https://help.aliyun.com/zh/model-studio/qwen-vl-ocr-api-reference)

本项目与阿里云、百炼、Manggo 或 Bob 官方均无隶属或合作关系。“阿里云”“百炼”及相关模型名称属于各自权利人。项目图标为本仓库原创资产，不使用阿里云官方产品图标。

## License

[MIT](LICENSE)
