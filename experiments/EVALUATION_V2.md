# SemanticDocument v2 分层评测

## 三层验证

1. **模型理解**：原始模型输出先通过 `SemanticDocument 2.0` Schema，再分别核验事实、单位、否定、纠正、多指标、主次、动作语义和展示偏好。
2. **规则决策**：每个样本携带人工确认的 `confirmedSemantics`；规则层只消费该结构和宿主上下文，核验四态、组件集合、动作事件与交付门禁。
3. **端到端**：模型原始语义直接进入相同规则层，分别统计 `correctCards`、`incorrectCards`、`appropriateNonReady` 和 `deliverable`，不再用旧 `planToDSL` 代替新链路。

`dataset-v2.mjs` 仅用于开发校准，`independent=false`，不得据此宣称 Qwen 泛化成绩。第一轮 v1 数据、评分器和结果继续保留；`scoring-v1.mjs` 仅用于历史复核。

## 独立数据集门禁

仓库内的 `independent-v2.mjs` 包含 12 条在 v2 协议、提示、规则和校准完成后冻结的新输入，未用于本轮修复或提示调整。它已经通过 Schema、人工确认语义、规则预期和宿主上下文预检。这里的“独立”指相对于开发校准过程独立，尚不等于外部人员双盲评审；报告必须保留这项限制。

如需更强的人员独立性，可复制 `independent-dataset-v2.template.json`，由未参与实现的人编写和盲审样本后设置：

```json
"independent": true
```

每个样本格式可参考 `dataset-v2.mjs`。运行器会在发出任何模型请求前执行以下检查：

- 必须显式传入 `--dataset`；
- 数据集必须声明 `independent=true`；
- 每项必须包含输入、人工确认语义、宿主上下文和分层预期；
- 人工确认语义必须通过 v2 Schema；
- 规则层对人工确认语义必须命中预期。

校准本地链路：

```powershell
npm run eval:local -- --label local-v2-calibration
```

独立 Qwen 实验（本轮不执行）：

```powershell
npm run eval:qwen -- --dataset experiments/independent-v2.mjs --label qwen-independent-v2 --concurrency 2
```

无需调用模型的预检：

```powershell
npm run eval:preflight
```

结果写入新的 `experiments/results/<label>/`，使用 `wx` 创建元数据，避免覆盖既有实验。
