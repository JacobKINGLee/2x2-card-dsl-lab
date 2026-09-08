import {readFile,writeFile} from 'node:fs/promises';
const runs=[['local-baseline','本地规则'],['qwen-baseline','Qwen 原提示'],['qwen-explicit-v1','Qwen 明确协议提示']];
const loaded=await Promise.all(runs.map(async([id,name])=>({id,name,
  summary:JSON.parse(await readFile(`experiments/results/${id}/summary.json`,'utf8')),
  metadata:JSON.parse(await readFile(`experiments/results/${id}/metadata.json`,'utf8')),
  records:(await readFile(`experiments/results/${id}/records.jsonl`,'utf8')).trim().split('\n').map(line=>JSON.parse(line)),
})));
const percent=m=>`${m.passed}/${m.total}（${m.total?(m.passed/m.total*100).toFixed(1):'—'}%）`;
const metric=(title,key)=>`| ${title} | ${loaded.map(r=>percent(r.summary.core[key])).join(' | ')} |`;
const assertion=(title,key)=>`| ${title} | ${loaded.map(r=>percent(r.summary.core.assertions[key])).join(' | ')} |`;
let report=`# Qwen3-8B 卡片语义实验报告

日期：2026-09-07。所有数值来自保存的真实运行结果，未将模拟测试、规则回退或布局压力测试充当模型成绩。

## 实验结论

明确协议后，原始Schema合法率从25.0%提高到93.3%，核心值正确率从96.7%提高到97.5%，严格联合通过率从10.8%提高到54.2%，仍未达到暂定95%联合通过门槛。当前8B模型具有较强的核心值提取能力，但按现有语义计划稳定生成符合全部规范的卡片尚未验证成功。输出合法JSON、满足Schema、选对语义和通过布局门禁是不同指标，不能用修复后100%可布局代替模型正确率。

## 设计

- 120 条正常输入来自40个语义案例，每例3种表达，覆盖8领域；另有12条边界探针，单独报告。全量数据见各次运行的 dataset.json。
- 对照为规则解析器、当前短提示、增加现有协议说明的提示。模型均请求 qwen3-8b，temperature=0.1、enable_thinking=false、max_tokens=900、Function Calling required；并发2，无模型重试，无规则回退。
- 增强提示只明确现有领域映射、组件/单位/状态/事件规则，没有改Schema、预期值或评分。它是基于开发案例观察的同集迭代结果，不是独立盲测成绩；预留24条也共享模板，不能作为充分的泛化证据。
- 本机无可用openPangu密钥，未跑同集大模型对照，不能判断与大模型差距。
- 原始HTTP响应、请求模板、耗时、tokens、源码哈希、归一化差异、DSL及Layout IR均已保存。不会记录Authorization或API Key。

## 正常场景结果

| 指标 | ${loaded.map(r=>r.name).join(' | ')} |
| --- | --- | --- | --- |
${metric('接口/执行完成','transport')}
${metric('原始JSON可解析','json')}
${metric('原始Schema合法','schema')}
${assertion('核心值正确','value')}
${assertion('单位符合预期','unit')}
${assertion('领域符合预期','domain')}
${assertion('主视觉组件符合规范','visualization')}
${assertion('进度值正确（仅进度/评分案例）','progressValue')}
${assertion('预设状态词符合预期（部分案例）','state')}
${assertion('按钮文字含预设操作关键词','actionLabel')}
${metric('全部自动语义/规范断言通过','semantic')}
${metric('归一化后DSL合法','dsl')}
${metric('归一化后引擎门禁通过','engine')}
${metric('Schema＋全部断言＋引擎联合通过','joint')}
| 发生归一化的样本 | ${loaded.map(r=>r.summary.core.normalized).join(' | ')} |

**计分限制：**“全部断言”是本轮预先编写的严格验收规则，不是完整人工语义正确率。原协议state允许任意字符串，但本评测只接受预设规范状态词；例如low_battery可能语义合理却不通过warning断言。按钮通用“查看详情”可能可用，但缺少预设主题词时不通过。value允许重复声明单位的等价表示，Schema之外的字符串文案、辅助信息幻觉、事件实际可执行性均没有被自动充分检验。actionEvent只校验格式，尚无动作白名单语义核验。原始模型自报confidence不用于计分。

引擎使用estimatedTextMeasurer，不是浏览器实测；门禁通过不等于真实屏幕无截断或文案完全正确。原始Schema不合法的样本仅为诊断而继续归一化，正式Aliyun API路径会拒绝并标注规则回退。

## 延迟与用量

| 配置 | 正常样本p50 | 正常样本p95 | 全部样本输入tokens | 全部样本输出tokens |
| --- | --- | --- | --- | --- |
${loaded.map(r=>`| ${r.name} | ${(r.summary.core.latencyMs.p50/1000).toFixed(3)}s | ${(r.summary.core.latencyMs.p95/1000).toFixed(3)}s | ${r.records.reduce((n,x)=>n+(x.usage?.prompt_tokens||0),0)} | ${r.records.reduce((n,x)=>n+(x.usage?.completion_tokens||0),0)} |`).join('\n')}

云模型时间包含网络、排队与完整响应读取，不含后续布局计算；本地规则时间包含规则解析和评分/布局，二者不能直接用作推理性能比值。这里没有测端侧内存、量化、功耗、冷启动或设备tokens/s。API返回的模型标识为：${[...new Set(loaded.flatMap(r=>r.records.map(x=>x.responseModel).filter(Boolean)))].join(', ')}；服务权重、精度与硬件未独立核验。

## 按领域的联合通过

| 领域 | ${loaded.map(r=>r.name).join(' | ')} |
| --- | --- | --- | --- |
${Object.keys(loaded[0].summary.byDomain).map(domain=>`| ${domain} | ${loaded.map(r=>percent(r.summary.byDomain[domain].joint)).join(' | ')} |`).join('\n')}
`;
for(const r of loaded.filter(r=>r.id!=='local-baseline')) {
  const schemaCounts={}; const failureCounts={};
  for(const record of r.records.filter(x=>x.scope==='core')) {
    for(const error of record.schemaErrors||[])schemaCounts[error]=(schemaCounts[error]||0)+1;
    for(const [field,pass]of Object.entries(record.assertions||{}))if(!pass)failureCounts[field]=(failureCounts[field]||0)+1;
  }
  report+=`\n## ${r.name}：错误分布\n\nSchema错误次数（同一样本可能多项）：\n\n${Object.entries(schemaCounts).sort((a,b)=>b[1]-a[1]).map(([error,count])=>`- ${error}: ${count}`).join('\n')||'- 无'}\n\n断言失败次数：\n\n${Object.entries(failureCounts).sort((a,b)=>b[1]-a[1]).map(([field,count])=>`- ${field}: ${count}`).join('\n')}\n`;
}
const improved=loaded[2];
report+='\n## 边界观察与人工复核重点\n\n- 无按钮需求返回空动作，符合用户意图却违反当前必填Schema，说明协议本身需要调整。\n- 多指标请求未返回单一计划；完整原始响应保存在records.jsonl，不能算单卡成功。\n- 纠正会议时间正确提取16:30，缺失心率以“缺失”表示，没有直接编造0。\n- 电量18%与82%冲突时仍选择18%作为主指标，不能算消除了歧义。\n- 120%超额进度原样放进progressValue，越过Schema上限。\n- 图片需求被变成文件名文字卡片，写诗请求被强行转为诗句指标卡。\n- 注入HTML/CSS的探针没有破坏结构协议，但模型补出了输入未要求的充电操作；内存18%被解释为警告也缺乏依据。结构安全与忠实理解必须分别判断。\n\n## 明确协议提示：边界探针原始结果\n\n以下仅为观察，不计算统一成功率。原始模型输出是实验数据。\n';
for(const record of improved.records.filter(x=>x.scope==='boundary')) {
  const note=improved.summary.boundary.find(x=>x.id===record.id)?.note;
  report+=`\n### ${record.id}\n\n输入：${record.text}\n\n预设检查：${note}\n\n`;
  report+=record.rawPlan ? `\
\
~~~json
${JSON.stringify(record.rawPlan,null,2)}
~~~
` : `未取得单个可解析计划：${record.error}\n`;
}
report+=`\n## 下一步\n\n1. 优先做协议分工实验：模型提取数据类型、值、单位和操作意图；组件选择、进度换算、图标、事件映射交给确定性编译器。保留本轮基线，新的协议另起版本。\n2. 给无动作、缺失数据、无法表示、多指标及需澄清增加显式状态，避免强行出卡。建立action intent白名单与真实事件映射。\n3. 对120条输出进行独立人工复核，尤其检查辅助文案幻觉、遗漏和按钮意图；收集新的真实用户输入做盲测。\n4. 有同集openPangu数据后再判断与大模型差距。只有错误归因表明需要模型适配时才安排微调/蒸馏。\n5. 明确目标设备和内存/延迟预算后，部署量化版本并使用相同评测器验证准确率、冷/热启动、峰值内存和连续运行性能。\n\n## 复现\n\n要求Node.js 22.15+（实际使用24.13.0），凭据来自Git忽略的.env.local。每次使用新的label，禁止覆盖已有metadata。\n\n~~~powershell\nnpm run test:semantic\nnpm run eval:local -- --label local-new --concurrency 1\nnpm run eval:qwen -- --label qwen-new --profile baseline --concurrency 2\nnpm run eval:qwen -- --label qwen-explicit-new --profile explicit-v1 --concurrency 2\n~~~\n\n提示实现见app/semantic-model.ts，数据见experiments/dataset.mjs，评分见experiments/scoring.mjs。页面Aliyun默认使用explicit-v1，可通过ALIYUN_MAAS_PROMPT_PROFILE=baseline切回原提示。评测默认仍为baseline，需要显式选择对照配置。\n\n接口参数依据：[阿里云深度思考文档](https://www.alibabacloud.com/help/en/model-studio/deep-thinking)、[Function Calling文档](https://docs.modelstudio.console.alibabacloud.com/en/model-studio/qwen-function-calling)。专属端点实际支持情况通过本轮调用确认，不能仅凭tool_choice=required推断严格Schema约束解码已启用。\n`;
await writeFile('experiments/REPORT.md',report);
const csv=['run,id,scope,schema,semantic,engine,joint,latency_ms,failed_assertions',...loaded.flatMap(r=>r.records.map(x=>[r.id,x.id,x.scope,!!x.schemaPass,x.semanticPass??'',!!x.enginePass,x.jointPass??'',Math.round(x.latencyMs),Object.entries(x.assertions||{}).filter(([,v])=>!v).map(([k])=>k).join('|')].join(',')))].join('\n');
await writeFile('experiments/results/comparison.csv',csv);
console.log(JSON.stringify(loaded.map(r=>({run:r.id,completed:r.summary.completed,schema:r.summary.core.schema,semantic:r.summary.core.semantic,joint:r.summary.core.joint}))));
