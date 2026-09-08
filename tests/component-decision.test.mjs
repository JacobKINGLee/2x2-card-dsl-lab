import assert from "node:assert/strict";
import test from "node:test";
import {
  compileComponentDecision,
  parseDecisionHostContext,
} from "../app/component-decision.ts";
import { applyDeliveryGate } from "../app/delivery-gate.ts";
import { extractSemanticsLocally } from "../app/local-semantic-extractor.ts";
import { validateSemanticDocument } from "../app/semantic-protocol.ts";
import { parseElementDSL, solveLayout } from "../app/layout-engine.ts";
import { POST } from "../app/api/interpret/route.ts";

const saving = {
  version: "test-context-v1",
  actions: [{
    id: "saving",
    intents: ["enableSaving"],
    label: "开启省电",
    event: "enablePowerSaving",
    target: "battery",
    available: true,
    icon: "zap",
    iconReviewed: true,
  }],
};
const batteryDetail = {
  actions: [{
    id: "battery-detail",
    intents: ["viewBatteryDetail"],
    label: "查看电池详情",
    event: "openBatteryDetail",
    target: "battery",
  }],
};
const pause = {
  actions: [{
    id: "pause",
    intents: ["pauseMedia"],
    label: "暂停播放",
    event: "pausePlayback",
    target: "media",
    icon: "bell-off",
    iconReviewed: true,
  }],
};
const clean = {
  actions: [{
    id: "clean",
    intents: ["cleanMemory"],
    label: "清理内存",
    event: "cleanDeviceMemory",
    target: "memory",
  }],
};

function compile(text, context = {}) {
  const semantics = extractSemanticsLocally(text);
  assert.deepEqual(validateSemanticDocument(semantics), []);
  return applyDeliveryGate(compileComponentDecision(semantics, context));
}

function types(result) {
  return result.dsl?.elements.map((element) => element.type) ?? [];
}

function element(result, type) {
  return result.dsl?.elements.find((item) => item.type === type);
}

function assertReady(result) {
  assert.equal(result.status, "ready");
  assert.equal(result.delivery?.status, "deliverable");
  assert.ok(result.dsl);
  const parsed = parseElementDSL(JSON.stringify(result.dsl));
  assert.ok(parsed.data, parsed.errors.join("; "));
  const layout = solveLayout(parsed.data);
  assert.equal(layout.status, "solved");
  assert.notEqual(layout.quality.status, "rejected");
}

test("rule layer consumes SemanticDocument fields without receiving source text", () => {
  const semantics = {
    version: "2.0",
    task: "card",
    domain: "productivity",
    topic: "自定义计时",
    state: "informative",
    emphasis: "standard",
    facts: [{
      id: "focus",
      subject: "focus",
      label: "专注时长",
      value: "25",
      unit: "分钟",
      dataType: "duration",
      progressSemantics: "none",
      scale: null,
      polarity: "asserted",
      status: "current",
      role: "primary",
      required: true,
      source: "opaque-evidence-token",
    }],
    actions: { mode: "unmentioned", requests: [], forbiddenIntents: [] },
    presentation: { title: "default", primaryVisual: "default", button: "default" },
    ambiguities: [],
  };
  assert.deepEqual(validateSemanticDocument(semantics), []);
  const result = applyDeliveryGate(compileComponentDecision(semantics));
  assertReady(result);
  assert.equal(element(result, "heroMetric").value, "25");
  assert.equal(element(result, "heroMetric").unit, "分钟");
});

test("X01 fact-only battery uses miniProgress without action or app identity", () => {
  const result = compile("手机电量18%");
  assertReady(result);
  assert.deepEqual(types(result), ["text", "miniProgress"]);
  assert.equal(element(result, "miniProgress").displayValue, "18%");
});

test("X02/X03 action availability is supplied by host context", () => {
  const input = "手机电量18%，开启省电模式";
  const ready = compile(input, saving);
  assertReady(ready);
  assert.equal(element(ready, "capsuleButton").event, "enablePowerSaving");
  assert.equal(compile(input).status, "unsupported");
  assert.equal(compile(input).decision.code, "unknown_action");
});

test("X04 global action prohibition wins over available capability", () => {
  const result = compile("手机电量18%，只展示，不要按钮", saving);
  assertReady(result);
  assert.ok(!types(result).some((type) => type.endsWith("Button")));
  assert.ok(result.decision.matchedRules.includes("A01"));
});

test("X05 a scoped prohibition does not suppress another requested action", () => {
  const result = compile("手机电量18%，不要省电，只查看电池详情", batteryDetail);
  assertReady(result);
  assert.equal(element(result, "capsuleButton").event, "openBatteryDetail");
});

test("X06 explicit big-number preference overrides percentage default", () => {
  const result = compile("手机电量83%，只要大数字，不要进度条");
  assertReady(result);
  assert.equal(element(result, "heroMetric").value, "83");
  assert.equal(element(result, "heroMetric").unit, "%");
});

test("X07 explicit endurance priority keeps battery as auxiliary fact", () => {
  const result = compile("还可用2小时，剩余电量18%，突出续航");
  assertReady(result);
  assert.equal(element(result, "heroMetric").value, "2");
  assert.equal(element(result, "heroMetric").unit, "小时");
  assert.match(element(result, "heroMetric").detail, /18%/);
});

test("natural battery request keeps percentage primary, endurance secondary, and verifies the requested action", () => {
  const input = "手机电量只剩18%，预计还能使用2小时。我希望能点“开启省电模式”。";
  const semantics = extractSemanticsLocally(input);
  assert.equal(semantics.facts.find((fact) => fact.id === "battery").role, "primary");
  assert.equal(semantics.facts.find((fact) => fact.id === "endurance").role, "secondary");
  assert.equal(semantics.actions.requests[0].intent, "enableSaving");
  const result = compile(input, saving);
  assertReady(result);
  assert.equal(element(result, "miniProgress").displayValue, "18%");
  assert.match(element(result, "miniProgress").detail, /2小时/);
  assert.equal(element(result, "capsuleButton").event, "enablePowerSaving");
});

test("X08 parallel metrics remain independent", () => {
  const result = compile("显示CPU32%、内存4.5GB、磁盘68%");
  assertReady(result);
  assert.equal(types(result).filter((type) => type === "metric").length, 3);
  assert.deepEqual(result.dsl.elements.filter((item) => item.type === "metric").map((item) => item.value), ["32%", "4.5GB", "68%"]);
});

test("X09/X10 score ring requires an explicit scale", () => {
  const scaled = compile("睡眠82分，满分100");
  assertReady(scaled);
  assert.equal(element(scaled, "progressRing").value, 82);
  assert.equal(element(scaled, "progressRing").displayValue, "82分");
  const unscaled = compile("评分4.2分");
  assertReady(unscaled);
  assert.equal(element(unscaled, "heroMetric").value, "4.2");
});

test("X11 legal over-completion preserves display value and clamps fill", () => {
  const result = compile("运动目标完成120%");
  assertReady(result);
  assert.equal(element(result, "miniProgress").value, 100);
  assert.equal(element(result, "miniProgress").displayValue, "120%");
  assert.match(element(result, "miniProgress").detail, /超额/);
});

test("X12 missing measurement is text, never a fabricated zero", () => {
  const result = compile("设备心率暂无数据");
  assertReady(result);
  assert.ok(types(result).includes("text"));
  assert.ok(!types(result).some((type) => ["heroMetric", "miniProgress", "progressRing"].includes(type)));
  assert.doesNotMatch(JSON.stringify(result.dsl), /"value":"?0/);
});

test("X13 conflicting values require clarification", () => {
  const result = compile("电量显示18%又显示82%，不确定哪个对");
  assert.equal(result.status, "needs_clarification");
  assert.equal(result.dsl, null);
  assert.deepEqual(result.decision.alternatives, ["18%", "82%"]);
});

test("conflict paraphrase '无法确认哪个正确' also requires clarification", () => {
  const result = compile("当前电量一处显示18%，另一处显示82%，无法确认哪个正确");
  assert.equal(result.status, "needs_clarification");
  assert.equal(result.decision.code, "conflicting_fact");
});

test("X14 an explicit correction uses the revised time", () => {
  const result = compile("会议从15:00改到16:30");
  assertReady(result);
  assert.equal(element(result, "heroMetric").value, "16:30");
  assert.match(element(result, "heroMetric").detail, /15:00/);
});

test("X15 reviewed action icon enables iconButton", () => {
  const result = compile("暂停当前播放，用图标按钮", pause);
  assertReady(result);
  assert.equal(element(result, "iconButton").event, "pausePlayback");
  assert.equal(element(result, "iconButton").label, "暂停播放");
});

test("X16 ambiguous action visual defaults to capsuleButton", () => {
  const result = compile("清理内存", clean);
  assertReady(result);
  assert.equal(element(result, "capsuleButton").event, "cleanDeviceMemory");
});

test("X17/X18 image resource is verified and incompatible bodies are rejected", () => {
  const ready = compile("展示这张照片", { image: { id: "photo-1", src: "/photo.jpg", alt: "湖边日落", verified: true } });
  assertReady(ready);
  assert.equal(element(ready, "image").src, "/photo.jpg");
  const conflict = compile("展示这张照片和三个必须保留的指标：CPU32%、内存4.5GB、磁盘68%", { image: { id: "photo-1", src: "/photo.jpg", alt: "湖边日落", verified: true } });
  assert.equal(conflict.status, "unsupported");
  assert.equal(conflict.decision.code, "image_metric_conflict");
});

test("X19 verified single application identity adds appIcon", () => {
  const result = compile("手机电量18%", {
    application: { id: "battery-app", label: "设备管家", showSource: true, singleSource: true, resource: { id: "device-manager-icon", symbol: "管", verified: true } },
  });
  assertReady(result);
  assert.equal(element(result, "appIcon").label, "设备管家");
});

test("X20 multi-source content never claims one app identity", () => {
  const result = compile("同时展示两个应用的数据：CPU32%、磁盘68%", {
    application: { id: "one-app", label: "应用甲", showSource: true, singleSource: false, resource: { id: "app-a-icon", symbol: "甲", verified: true } },
  });
  assertReady(result);
  assert.equal(element(result, "appIcon"), undefined);
});

test("X21 below-zero temperature is normalized without losing its sign", () => {
  const result = compile("气温零下5摄氏度");
  assertReady(result);
  assert.equal(element(result, "heroMetric").value, "-5");
  assert.equal(element(result, "heroMetric").unit, "°C");
});

test("X22 non-card task returns no_card", () => {
  const result = compile("写一首秋天的诗");
  assert.equal(result.status, "no_card");
  assert.equal(result.dsl, null);
});

test("specific action negation cannot produce the forbidden button", () => {
  const result = compile("手机电量18%，不要清理内存", clean);
  assertReady(result);
  assert.equal(element(result, "capsuleButton"), undefined);
  const semantics = extractSemanticsLocally("手机电量18%，不要清理内存");
  assert.deepEqual(semantics.actions.requests, []);
  assert.deepEqual(semantics.actions.forbiddenIntents, ["cleanMemory"]);
});

test("duration unit is not reclassified as score", () => {
  const semantics = extractSemanticsLocally("今天专注25分钟");
  assert.equal(semantics.facts[0].dataType, "duration");
  const result = applyDeliveryGate(compileComponentDecision(semantics));
  assertReady(result);
  assert.equal(element(result, "heroMetric").unit, "分钟");
});

test("fact correction removes negated battery from the delivered card", () => {
  const semantics = extractSemanticsLocally("不是电量18%，是内存占用18%");
  assert.equal(semantics.domain, "system");
  assert.equal(semantics.facts.find((fact) => fact.subject === "battery").polarity, "negated");
  const result = applyDeliveryGate(compileComponentDecision(semantics));
  assertReady(result);
  assert.equal(element(result, "miniProgress").label, "内存占用");
});

test("negative bounded percentage preserves sign and requires clarification", () => {
  const semantics = extractSemanticsLocally("电量−5%");
  assert.equal(semantics.facts[0].value, "-5");
  const result = applyDeliveryGate(compileComponentDecision(semantics));
  assert.equal(result.status, "needs_clarification");
  assert.equal(result.decision.code, "invalid_measurement");
  assert.equal(result.dsl, null);
});

test("required long notification is never truncated into a misleading ready card", () => {
  const input = "重要通知：由于场地临时关闭，原定活动安排全部作废，请告知参与者并更新日程，会议已取消，请勿前往";
  const semantics = extractSemanticsLocally(input);
  assert.ok(semantics.facts[0].value.endsWith("会议已取消，请勿前往"));
  const result = applyDeliveryGate(compileComponentDecision(semantics));
  assert.equal(result.status, "unsupported");
  assert.equal(result.decision.code, "required_text_too_long");
  assert.equal(result.dsl, null);
});

test("resource identifiers require an explicit host verification result", () => {
  const image = extractSemanticsLocally("展示这张照片");
  const result = applyDeliveryGate(compileComponentDecision(image, {
    image: { id: "photo-1", src: "/photo.jpg", alt: "湖边日落", verified: false },
  }));
  assert.equal(result.status, "unsupported");
  assert.equal(result.decision.code, "unverified_image_resource");
});

test("host context rejects unexecutable event identifiers", () => {
  const parsed = parseDecisionHostContext({ actions: [{ id: "x", intents: ["cleanMemory"], label: "清理", event: "bad_event" }] });
  assert.equal(parsed.data, null);
  assert.match(parsed.errors.join(";"), /event/);
});

test("interpret API exposes non-ready states without a misleading DSL", async () => {
  const response = await POST(new Request("http://localhost/api/interpret", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode: "local", text: "手机电量18%，开启省电模式" }),
  }));
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.status, "unsupported");
  assert.equal(payload.dsl, null);
  assert.equal(payload.decision.code, "unknown_action");
});

test("interpret API rejects malformed host capabilities", async () => {
  const response = await POST(new Request("http://localhost/api/interpret", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mode: "local",
      text: "清理内存",
      context: { actions: [{ id: "clean", intents: ["cleanMemory"], label: "清理", event: "bad_event" }] },
    }),
  }));
  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /event/);
});
