# 2x2 Card DSL Lab

项目从 V0.1 到 V0.8 的完整功能演进、对话决策和当前架构，请参阅
[PROJECT_EVOLUTION_V0.1_V0.8.md](./PROJECT_EVOLUTION_V0.1_V0.8.md)。

## Qwen3-8B 语义编译实验

当前交付链路使用 `SemanticDocument 2.0`：模型只提取事实、单位、主次、否定/纠正、动作语义和展示偏好；`ux-component-v0.1` 规则层只接收该结构与宿主 `context`，不读取原始自然语言。API 返回 `ready`、`needs_clarification`、`unsupported` 或 `no_card`；只有通过 DSL 与布局交付门禁的 `ready` 才包含 DSL。动作事件、应用身份和图片资源只接受宿主验证上下文，不由模型补造。

22 个规范案例可独立验证：

```powershell
npm run test:decision
```

实验计划见 [experiments/PLAN.md](./experiments/PLAN.md)，真实批量结果与限制见
[experiments/REPORT.md](./experiments/REPORT.md)。当前已接入阿里云专属 OpenAI 兼容端点，
通过服务端 `.env.local` 中的 `SEMANTIC_MODEL_PROVIDER=aliyun` 和 `ALIYUN_MAAS_*` 配置启用；
字段模板见 `.env.example`，不要提交真实密钥。

线上模型路径使用 v2 结构化语义 Schema；失败会明确显示 `LOCAL FALLBACK`。独立评测器保存原始响应且不启用回退。旧 Semantic Plan、v1 评分器和历史结果继续保留用于复核。

v2 评测说明见 [experiments/EVALUATION_V2.md](./experiments/EVALUATION_V2.md)。校准数据不会用于 Qwen 结论；已另行冻结并预检 12 条 `independent-v2.mjs` 新输入。Qwen 运行器强制要求显式数据集和 `independent=true`，避免误跑开发集。

评测脚本要求 Node.js 22.15+，本轮实际使用24.13.0：

```powershell
npm run test:semantic
npm run eval:local -- --label local-v2-calibration --concurrency 1
npm run eval:qwen -- --dataset experiments/independent-v2.mjs --label qwen-independent-v2 --concurrency 2
```

每次使用新的 `--label`，结果保存到 `experiments/results/<label>/`，已有结果不会被覆盖。

## Windows 本地演示（推荐）

本方案完全在演示电脑上运行，不依赖 `chatgpt.site`，启动后访问：

```text
http://localhost:3000
```

演示前请完成一次准备：

1. 在演示电脑安装 Node.js `22.13.0` 或更高版本。
2. 将本项目完整复制或从 GitHub 克隆到演示电脑。
3. 在有网络时双击 `start-local-demo.bat`。第一次运行会自动执行 `npm install`。
4. 确认页面成功打开后，可断开网络再次运行脚本验证离线演示。

正式演示时，双击 `start-local-demo.bat` 即可。脚本会构建项目、启动本地服务并打开浏览器。演示结束后，关闭标题为 `2x2 Card DSL Local Server` 的命令行窗口即可停止服务。

也可以使用命令行：

```bash
npm install
npm run build
npm run demo:local
```

`localhost` 只能从运行服务的这台电脑访问。若需要同一局域网内的其他设备访问，可以运行 `npm run demo:lan`，再使用演示电脑的局域网 IP；该方式可能受到 Windows 防火墙或单位网络策略影响。

A clean full-stack starter running on
[vinext](https://github.com/cloudflare/vinext), with optional Cloudflare D1 and
Drizzle support.

## Prerequisites

- Node.js `>=22.13.0`

## Quick Start

```bash
npm install
npm run dev
npm run build
```

This starter does not use `wrangler.jsonc`.

## Included Shape

- edit site code under `app/`
- `.openai/hosting.json` declares optional Sites D1 and R2 bindings
- `vite.config.ts` simulates declared bindings for local development
- `db/schema.ts` starts intentionally empty
- `examples/d1/` contains an optional D1 example surface
- `drizzle.config.ts` supports local migration generation when needed

## Workspace Auth Headers

Signed-in visitors receive both `oai-authenticated-user-id` and `oai-authenticated-user-email`. Private Sites require every visitor to sign in; public Sites may also have anonymous visitors, for whom neither header is present.

The user ID is stable for the same user on the same Site and different across Sites. Email and name are intended for display or contact purposes.

SIWC-authenticated workspace sites may also receive
`oai-authenticated-user-full-name` when the user's SIWC profile has a non-empty
`name` claim. The full-name value is percent-encoded UTF-8 and is accompanied by
`oai-authenticated-user-full-name-encoding: percent-encoded-utf-8`.

Treat the full name as optional and fall back to email when it is absent:

```tsx
import { headers } from "next/headers";

export default async function Home() {
  const requestHeaders = await headers();
  const userId = requestHeaders.get("oai-authenticated-user-id");
  const email = requestHeaders.get("oai-authenticated-user-email");
  const encodedFullName = requestHeaders.get("oai-authenticated-user-full-name");
  const fullName =
    encodedFullName &&
    requestHeaders.get("oai-authenticated-user-full-name-encoding") ===
      "percent-encoded-utf-8"
      ? decodeURIComponent(encodedFullName)
      : null;

  const displayName = fullName ?? email;
  // ...
}
```

## Optional Dispatch-Owned ChatGPT Sign-In

Import the ready-to-use helpers from `app/chatgpt-auth.ts` when the site needs
optional or required ChatGPT sign-in:

- Use `getChatGPTUser()` for optional signed-in UI.
- Use `requireChatGPTUser(returnTo)` for server-rendered pages that should send
  anonymous visitors through Sign in with ChatGPT.
- Use `chatGPTSignInPath(returnTo)` and `chatGPTSignOutPath(returnTo)` for
  browser links or actions.
- Pass a same-origin relative `returnTo` path for the destination after sign-in
  or sign-out. The helper validates and safely encodes it.
- Mark protected pages with `export const dynamic = "force-dynamic"` because
  they depend on per-request identity headers.

Dispatch owns `/signin-with-chatgpt`, `/signout-with-chatgpt`, `/callback`, the
OAuth cookies, and identity header injection. Do not implement app routes for
those reserved paths. Routes that do not import and call the helper remain
anonymous-compatible.

SIWC establishes identity only; it does not prove workspace membership. Use the
Sites hosting platform's access policy controls for workspace-wide restrictions,
or enforce explicit server-side membership or allowlist checks.

Use SIWC for account pages, user-specific dashboards, saved records, and write
actions tied to the current ChatGPT user. Leave public content anonymous.

## Useful Commands

- `npm run dev`: start local development
- `npm run build`: verify the vinext build output
- `npm test`: build the starter and verify its rendered loading skeleton
- `npm run db:generate`: generate Drizzle migrations after schema changes

## Learn More

- [vinext Documentation](https://github.com/cloudflare/vinext)
- [Drizzle D1 Guide](https://orm.drizzle.team/docs/get-started/d1-new)
