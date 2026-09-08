import {
  compileComponentDecision,
  parseDecisionHostContext,
  type DecisionHostContext,
} from "../../component-decision";
import { applyDeliveryGate } from "../../delivery-gate";
import { extractSemanticsLocally } from "../../local-semantic-extractor";
import {
  qwenSemanticRequest,
  semanticDocumentSchema,
  semanticExtractorInstructions,
  validateSemanticDocument,
} from "../../semantic-model";
import {
  type SemanticInterpretation,
} from "../../semantic-interpreter";
import type { SemanticDocument } from "../../semantic-protocol";

type InterpretRequest = {
  text?: unknown;
  mode?: unknown;
  context?: unknown;
};

type OpenAIResponse = {
  output_text?: unknown;
  output?: Array<{
    type?: string;
    content?: Array<{ type?: string; text?: unknown }>;
  }>;
};

type ChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: unknown;
      tool_calls?: Array<{
        function?: { name?: unknown; arguments?: unknown };
      }>;
    };
  }>;
};

type ModelConfig =
  | { provider: "openai"; apiKey: string; model: string }
  | { provider: "huawei"; apiKey: string; model: string; baseUrl: string }
  | { provider: "aliyun"; apiKey: string; model: string; baseUrl: string };

function outputText(payload: OpenAIResponse) {
  if (typeof payload.output_text === "string") return payload.output_text;
  for (const item of payload.output ?? []) {
    for (const content of item.content ?? []) {
      if (content.type === "output_text" && typeof content.text === "string") {
        return content.text;
      }
    }
  }
  return null;
}

function parseModelJson(value: unknown) {
  if (typeof value === "object" && value !== null) return value;
  if (typeof value !== "string") throw new Error("Model did not return JSON");
  const fenced = value.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1] ?? value;
  const start = fenced.indexOf("{");
  const end = fenced.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("Model output did not contain a JSON object");
  return JSON.parse(fenced.slice(start, end + 1));
}

function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function finalizeInterpretation(
  value: unknown,
  provider: "openai" | "huawei" | "aliyun",
  model: string,
  context: DecisionHostContext,
): SemanticInterpretation {
  const errors = validateSemanticDocument(value);
  if (errors.length) throw new Error(`Raw semantics failed schema: ${errors.join("; ")}`);
  const semantics = value as SemanticDocument;
  const result = applyDeliveryGate(compileComponentDecision(semantics, context));

  return {
    source: "llm",
    provider,
    model,
    notice: `${provider === "aliyun"
      ? "阿里云 Qwen 负责语义理解；这是云端小模型实验，布局和视觉由确定性引擎生成。"
      : provider === "huawei"
      ? "华为云 openPangu 负责语义理解；坐标、视觉和质量仍由确定性引擎生成。"
      : "OpenAI 模型只负责语义理解；坐标、视觉和质量仍由确定性引擎生成。"}${context.simulated ? " 当前应用能力上下文为模拟数据。" : ""}`,
    semantics,
    status: result.status,
    decision: result.decision,
    delivery: result.delivery,
    dsl: result.dsl,
  };
}

function fallbackInterpretation(text: string, notice: string, context: DecisionHostContext): SemanticInterpretation {
  const semantics = extractSemanticsLocally(text);
  const result = applyDeliveryGate(compileComponentDecision(semantics, context));
  return {
    source: "fallback",
    provider: "local",
    model: null,
    notice: `${notice}${context.simulated ? " 当前应用能力上下文为模拟数据。" : ""}`,
    semantics,
    status: result.status,
    decision: result.decision,
    delivery: result.delivery,
    dsl: result.dsl,
  };
}

function modelConfig(): ModelConfig | null {
  const preferred = process.env.SEMANTIC_MODEL_PROVIDER?.trim().toLowerCase();
  const huaweiKey = process.env.HUAWEI_MAAS_API_KEY?.trim();
  const openAIKey = process.env.OPENAI_API_KEY?.trim();
  const aliyunKey = process.env.ALIYUN_MAAS_API_KEY?.trim();
  const aliyunBaseUrl = process.env.ALIYUN_MAAS_BASE_URL?.trim();
  if (preferred === "aliyun" && aliyunKey && aliyunBaseUrl) {
    return { provider: "aliyun", apiKey: aliyunKey, baseUrl: aliyunBaseUrl,
      model: process.env.ALIYUN_MAAS_MODEL?.trim() || "qwen3-8b" };
  }

  if ((preferred === "huawei" || (!preferred && huaweiKey)) && huaweiKey) {
    return {
      provider: "huawei",
      apiKey: huaweiKey,
      baseUrl: process.env.HUAWEI_MAAS_BASE_URL?.trim() || "https://api.modelarts-maas.com/openai/v1",
      model: process.env.HUAWEI_MAAS_MODEL?.trim() || "openpangu-2.0-flash",
    };
  }
  if ((preferred === "openai" || !preferred) && openAIKey) {
    return {
      provider: "openai",
      apiKey: openAIKey,
      model: process.env.OPENAI_MODEL?.trim() || "gpt-5.4-mini",
    };
  }
  return null;
}

async function interpretWithOpenAI(text: string, config: Extract<ModelConfig, { provider: "openai" }>, context: DecisionHostContext) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.model,
      instructions: semanticExtractorInstructions,
      input: text,
      text: {
        format: {
          type: "json_schema",
          name: "card_semantic_document",
          strict: true,
          schema: semanticDocumentSchema,
        },
      },
      reasoning: { effort: "low" },
      max_output_tokens: 900,
      store: false,
    }),
    signal: AbortSignal.timeout(20_000),
  });

  if (!response.ok) throw new Error(`OpenAI request failed with ${response.status}`);
  const payload = await response.json() as OpenAIResponse;
  return finalizeInterpretation(parseModelJson(outputText(payload)), "openai", config.model, context);
}

async function interpretWithHuawei(text: string, config: Extract<ModelConfig, { baseUrl: string }>, context: DecisionHostContext) {
  const endpoint = `${config.baseUrl.replace(/\/+$/, "")}/chat/completions`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.model,
      stream: false,
      temperature: 0.1,
      max_tokens: 900,
      messages: [
        {
          role: "system",
          content: `${semanticExtractorInstructions}\n必须调用 emit_card_semantics 函数一次，并把完整 SemanticDocument 放入 arguments。`,
        },
        { role: "user", content: text },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "emit_card_semantics",
            description: "提交结构化内容语义；不选择组件，不生成可执行事件",
            parameters: semanticDocumentSchema,
          },
        },
      ],
      // openPangu accepts none/auto/required (rather than OpenAI's named
      // function object). There is only one tool, so required is deterministic.
      tool_choice: "required",
    }),
    signal: AbortSignal.timeout(20_000),
  });

  if (!response.ok) throw new Error(`Huawei MaaS request failed with ${response.status}`);
  const payload = await response.json() as ChatCompletionResponse;
  const message = payload.choices?.[0]?.message;
  const functionCall = message?.tool_calls?.find(
    (call) => call.function?.name === "emit_card_semantics",
  );
  const rawPlan = functionCall?.function?.arguments ?? message?.content;
  return finalizeInterpretation(parseModelJson(rawPlan), "huawei", config.model, context);
}

async function interpretWithModel(text: string, config: ModelConfig, context: DecisionHostContext) {
  if (config.provider === "aliyun") {
    const response = await fetch(`${config.baseUrl.replace(/\/+$/, "")}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(qwenSemanticRequest(text, config.model)),
      signal: AbortSignal.timeout(60_000),
    });
    if (!response.ok) throw new Error(`Aliyun MaaS request failed with ${response.status}`);
    const payload = await response.json() as ChatCompletionResponse;
    const calls = payload.choices?.[0]?.message?.tool_calls;
    if (calls?.length !== 1 || calls[0].function?.name !== "emit_card_semantics") {
      throw new Error("Qwen must emit exactly one semantic document tool call");
    }
    const args = calls[0].function.arguments;
    if (typeof args !== "string") throw new Error("Qwen tool arguments must be a JSON string");
    const raw: unknown = JSON.parse(args);
    const errors = validateSemanticDocument(raw);
    if (errors.length) throw new Error(`Qwen raw semantics failed schema: ${errors.join("; ")}`);
    return finalizeInterpretation(raw, "aliyun", config.model, context);
  }
  return config.provider === "huawei"
    ? interpretWithHuawei(text, config, context)
    : interpretWithOpenAI(text, config, context);
}

export async function POST(request: Request) {
  let body: InterpretRequest;
  try {
    body = await request.json() as InterpretRequest;
  } catch {
    return json({ error: "请求体必须是 JSON" }, 400);
  }

  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (text.length < 4) return json({ error: "请至少输入 4 个字符" }, 400);
  if (text.length > 500) return json({ error: "输入内容不能超过 500 个字符" }, 400);

  const parsedContext = parseDecisionHostContext(body.context);
  if (!parsedContext.data) return json({ error: `应用上下文无效：${parsedContext.errors.join("；")}` }, 400);
  const context = parsedContext.data;

  const mode = body.mode === "local" ? "local" : "auto";
  if (mode === "local") {
    return json(fallbackInterpretation(text, "已按用户选择使用确定性本地语义解析。", context));
  }

  const config = modelConfig();
  if (!config) {
    return json(fallbackInterpretation(
      text,
      "当前环境未配置可用的模型密钥，已自动使用确定性本地解析。",
      context,
    ));
  }

  try {
    return json(await interpretWithModel(text, config, context));
  } catch (error) {
    console.warn(
      "[semantic-interpreter] model result rejected:",
      error instanceof Error ? error.message : "Unknown model error",
    );
    return json(fallbackInterpretation(
      text,
      `${config.provider === "huawei" ? "华为云 MaaS" : config.provider === "aliyun" ? "阿里云 MaaS" : "OpenAI"} 暂时不可用，系统已安全回退到确定性本地解析。`,
      context,
    ));
  }
}
