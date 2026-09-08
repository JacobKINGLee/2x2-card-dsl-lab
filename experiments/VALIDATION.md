# 实施验证

2026-09-07。

## SemanticDocument v2

- 模型输出已接到结构化事实、主次、否定/纠正、动作语义和展示偏好；组件规则层不再读取原句。
- 修复并覆盖：特定动作否定、分钟误判评分、事实纠正、Unicode/ASCII 负百分比、必要长通知截断、冲突改写。
- API 的 `ready` 现在要求同时通过 DSL 校验、布局求解、质量门禁，且必要元素没有被移除或截断。
- 宿主应用与图片资源新增资源 ID 和 `verified` 验证结果；字符串格式合法不再被当作资源可用。
- v2 最终离线校准 r4 在严格事实数量、否定/动作集合和必要事实保留检查下达到 12/12 语义与规则断言通过、错误出卡 0；结果位于 `results/local-v2-calibration-r4/`。早期校准失败记录继续保留，未覆盖。
- 12 条冻结新输入位于 `independent-v2.mjs`，无模型预检已通过。它们独立于开发校准，但尚未经外部人员双盲评审；真实 Qwen v2 实验未运行，当前状态正好停在该实验之前。

## v1 历史验证

- 生产构建通过；原有6项SSR、图鉴、布局统计、语义编译、华为接口模拟和输入校验回归全部通过。
- 新增5项语义评测测试全部通过：严格Schema校验、修复不掩盖模型错误、单位评分、数据集完整性、Aliyun路由成功/拒绝/回退。
- 本轮涉及的TS/TSX与实验脚本定向ESLint通过。
- 已构建的真实`/api/interpret`路由通过用户提供的阿里云端点返回HTTP 200、source=llm、provider=aliyun、model=qwen3-8b、domain=energy、visualization=miniProgress；结果见results/route-smoke.json。
- 规则基线与两轮Qwen测试均为132条；校验器逐条重算评分并检查数据集一致性、重复ID、凭据泄漏。

全项目检查另有未解决项，位于本轮未修改的文件中：

- 全量`npm run lint`报告`app/catalog/page.tsx`中3处原生`<a>`导航到`/`的规则错误。
- 全量`tsc --noEmit --incremental false`报告`app/visual-resolver.ts`的foreground联合类型推断错误，以及`db/index.ts`、`worker/index.ts`的Cloudflare类型缺失。

因此没有声称完整类型检查通过。未进行目标设备测试；云端实验不能代表端侧量化表现。未发布网站或改变线上配置。
