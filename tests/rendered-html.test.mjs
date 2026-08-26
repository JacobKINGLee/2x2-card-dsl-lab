import assert from "node:assert/strict";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
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

test("server-renders the V3 constraint layout lab", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>2×2 Card DSL Lab<\/title>/i);
  assert.match(html, /LAYOUT ENGINE · V0\.3/);
  assert.match(html, /PRIORITY DEGRADATION/);
  assert.match(html, /随机组合压力测试/);
  assert.match(html, /SOLVE RATE/);
  assert.match(html, /UX VIOLATION RATE/);
  assert.match(html, /TEST CASE BROWSER/);
  assert.match(html, /GENERATED ELEMENT DSL/);
  assert.match(html, /SOLVER RESULT \/ LAYOUT IR/);
  assert.match(html, /NO X \/ Y ALLOWED/);
});

test("renders deterministic benchmark statistics", async () => {
  const response = await render();
  const html = await response.text();

  assert.match(html, /250(?:<!-- -->)? 组文本、图片与 1–4 指标卡片/);
  assert.match(html, /96\.4<small>%<\/small>/);
  assert.match(html, /94\.3<small>\/100<\/small>/);
  assert.match(html, /3\.6<small>%<\/small>/);
});
