import assert from "node:assert/strict";
import test from "node:test";

async function fetchWorker(path = "/", init = {}) {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  const headers = path === "/"
    ? { accept: "text/html", ...init.headers }
    : init.headers;
  return worker.fetch(
    new Request(new URL(path, "http://localhost/"), { ...init, headers }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the V8 content-driven card lab", async () => {
  const response = await fetchWorker();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>2×2 Card DSL Lab<\/title>/i);
  assert.match(html, /CONTENT-DRIVEN GENERATIVE UI · V0\.8/);
  assert.match(html, /自然语言语义编译器/);
  assert.match(html, /LLM AUTO/);
  assert.match(html, /优先使用已配置的云模型/);
  assert.match(html, /CONTENT → SEMANTIC PLAN → DSL/);
  assert.match(html, /VISUAL SCORE/);
  assert.match(html, /surface-gradient/);
  assert.match(html, /TOP 3 VISUAL CANDIDATES/);
  assert.match(html, /DIVERSITY-AWARE BATCH/);
  assert.match(html, /语义卡片画廊/);
  assert.match(html, /CONTRAST PASS/);
  assert.match(html, /composition-leading/);
  assert.match(html, /composition-centered/);
  assert.match(html, /composition-trailing/);
  assert.match(html, /left:24px;top:114px;width:112px;height:34px/);
  assert.match(html, /left:56px;top:116px;width:92px;height:32px/);
  assert.match(html, /PRIORITY DEGRADATION/);
  assert.match(html, /QUALITY GATE \+ AUTO REPAIR/);
  assert.match(html, /文本对比度≥4\.5:1/);
  assert.match(html, /触控区域≥32×32vp/);
  assert.match(html, /TOP REJECTION REASONS/);
  assert.match(html, /长文修复/);
  assert.match(html, /CONTENT → LLM \/ LOCAL SEMANTIC COMPILER → DSL → DUAL SOLVER → QUALITY GATE → RENDERER/);
  assert.match(html, /当前方案无需内容降级|AUTO REPAIR LOG/);
  assert.match(html, /随机组合压力测试/);
  assert.match(html, /SOLVE RATE/);
  assert.match(html, /UX VIOLATION RATE/);
  assert.match(html, /TEST CASE BROWSER/);
  assert.match(html, /RENDERER PREVIEW · 160×160vp/);
  assert.match(html, /UX CHECK RESULT/);
  assert.match(html, /GENERATED ELEMENT DSL/);
  assert.match(html, /SOLVER RESULT \/ LAYOUT IR/);
  assert.match(html, /NO X \/ Y ALLOWED/);
  assert.match(html, /href="\/catalog"/);
});

test("server-renders the complete Card DSL visual catalog", async () => {
  const response = await fetchWorker("/catalog");
  assert.equal(response.status, 200);
  const html = await response.text();

  assert.match(html, /Card DSL 组件与视觉语法图鉴/);
  assert.match(html, /8 个内容领域/);
  assert.match(html, /7 个色彩族/);
  assert.match(html, /3 档视觉强调/);
  assert.match(html, /9 类 DSL 组件/);
  assert.match(html, /14(?:<!-- -->)? 个内置语义图标/);
  assert.match(html, /DOMAIN × EMPHASIS/);
  assert.match(html, /heroMetric/);
  assert.match(html, /progressRing/);
  assert.match(html, /miniProgress/);
  assert.match(html, /cloud-rain/);
  assert.match(html, /footprints/);
  assert.match(html, /check/);
});

test("renders deterministic benchmark statistics", async () => {
  const response = await fetchWorker();
  const html = await response.text();

  assert.match(html, /250(?:<!-- -->)? 组文本、图片与 1–4 指标卡片/);
  assert.match(html, /96\.4<small>%<\/small>/);
  assert.match(html, /94\.3<small>\/100<\/small>/);
  assert.match(html, /3\.6<small>%<\/small>/);
});

test("compiles arbitrary content into validated semantic DSL without coordinates", async () => {
  const response = await fetchWorker("/api/interpret", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mode: "local",
      text: "今天上海空气质量 AQI 42，状态优。",
    }),
  });
  assert.equal(response.status, 200);
  const payload = await response.json();

  assert.equal(payload.source, "fallback");
  assert.equal(payload.provider, "local");
  assert.equal(payload.semantics.domain, "environment");
  assert.equal(payload.semantics.facts[0].value, "42");
  assert.equal(payload.status, "ready");
  assert.equal(payload.delivery.status, "deliverable");
  assert.equal(payload.dsl.context.domain, "environment");
  const primary = payload.dsl.elements.find((element) => element.type === "heroMetric");
  assert.equal(primary.value, "42");
  assert.ok(!payload.dsl.elements.some((element) => element.type.endsWith("Button")));
  assert.ok(!payload.dsl.elements.some((element) => element.type === "appIcon"));
  assert.doesNotMatch(JSON.stringify(payload.dsl), /"(?:x|y|width|height)"/);
});

test("uses Huawei MaaS tool calling and validates the returned semantic plan", async () => {
  const previousProvider = process.env.SEMANTIC_MODEL_PROVIDER;
  const previousKey = process.env.HUAWEI_MAAS_API_KEY;
  const previousBaseUrl = process.env.HUAWEI_MAAS_BASE_URL;
  const previousModel = process.env.HUAWEI_MAAS_MODEL;
  const originalFetch = globalThis.fetch;
  process.env.SEMANTIC_MODEL_PROVIDER = "huawei";
  process.env.HUAWEI_MAAS_API_KEY = "test-key";
  process.env.HUAWEI_MAAS_BASE_URL = "https://maas.example/openai/v1";
  process.env.HUAWEI_MAAS_MODEL = "openpangu-2.0-flash";

  globalThis.fetch = async (input, init) => {
    assert.equal(String(input), "https://maas.example/openai/v1/chat/completions");
    assert.equal(init.headers.Authorization, "Bearer test-key");
    const request = JSON.parse(init.body);
    assert.equal(request.model, "openpangu-2.0-flash");
    assert.equal(request.tools[0].function.name, "emit_card_semantics");
    assert.equal(request.tool_choice, "required");
    return Response.json({
      choices: [{
        message: {
          tool_calls: [{
            function: {
              name: "emit_card_semantics",
              arguments: JSON.stringify({
                version: "2.0",
                task: "card",
                domain: "energy",
                topic: "手机电量",
                state: "warning",
                emphasis: "high",
                facts: [{
                  id: "battery",
                  subject: "battery",
                  label: "剩余电量",
                  value: "18",
                  unit: "%",
                  dataType: "percentage",
                  progressSemantics: "bounded_measurement",
                  scale: null,
                  polarity: "asserted",
                  status: "current",
                  role: "primary",
                  required: true,
                  source: "电量只剩 18%",
                }],
                actions: {
                  mode: "specified",
                  requests: [{ intent: "enableSaving", label: "开启省电", target: "battery", required: true }],
                  forbiddenIntents: [],
                },
                presentation: { title: "default", primaryVisual: "default", button: "default" },
                ambiguities: [],
              }),
            },
          }],
        },
      }],
    });
  };

  try {
    const response = await fetchWorker("/api/interpret", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "auto",
        text: "手机电量只剩 18%，开启省电模式。",
        context: {
          actions: [{
            id: "saving",
            intents: ["enableSaving"],
            label: "开启省电",
            event: "enableSaving",
            target: "battery",
            available: true,
          }],
        },
      }),
    });
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.source, "llm");
    assert.equal(payload.provider, "huawei");
    assert.equal(payload.model, "openpangu-2.0-flash");
    assert.equal(payload.status, "ready");
    assert.equal(payload.delivery.status, "deliverable");
    assert.equal(payload.semantics.facts[0].value, "18");
    assert.equal(payload.dsl.elements.find((element) => element.type === "miniProgress").displayValue, "18%");
    assert.equal(payload.dsl.elements.find((element) => element.type === "capsuleButton").event, "enableSaving");
  } finally {
    globalThis.fetch = originalFetch;
    if (previousProvider === undefined) delete process.env.SEMANTIC_MODEL_PROVIDER;
    else process.env.SEMANTIC_MODEL_PROVIDER = previousProvider;
    if (previousKey === undefined) delete process.env.HUAWEI_MAAS_API_KEY;
    else process.env.HUAWEI_MAAS_API_KEY = previousKey;
    if (previousBaseUrl === undefined) delete process.env.HUAWEI_MAAS_BASE_URL;
    else process.env.HUAWEI_MAAS_BASE_URL = previousBaseUrl;
    if (previousModel === undefined) delete process.env.HUAWEI_MAAS_MODEL;
    else process.env.HUAWEI_MAAS_MODEL = previousModel;
  }
});

test("rejects underspecified natural-language input", async () => {
  const response = await fetchWorker("/api/interpret", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode: "local", text: "天气" }),
  });
  assert.equal(response.status, 400);
});
