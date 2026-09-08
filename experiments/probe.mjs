import { mkdir, writeFile } from 'node:fs/promises';
import { qwenRequest } from '../app/semantic-model.ts';
const base = process.env.ALIYUN_MAAS_BASE_URL;
const key = process.env.ALIYUN_MAAS_API_KEY;
if (!base || !key) throw new Error('Missing Aliyun server configuration');
const request = qwenRequest('手机电量只剩18%，预计还能使用2小时，开启省电模式。', process.env.ALIYUN_MAAS_MODEL || 'qwen3-8b');
const start = performance.now();
try {
  const response = await fetch(`${base}/chat/completions`, {
    method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(request), signal: AbortSignal.timeout(60000),
  });
  const body = (await response.text()).replaceAll(key, '[REDACTED]');
  await mkdir('experiments/results', { recursive: true });
  await writeFile('experiments/results/probe.json', JSON.stringify({ date: new Date().toISOString(), status: response.status, latencyMs: performance.now() - start, request, body }, null, 2));
  console.log(JSON.stringify({ status: response.status, latencyMs: performance.now() - start, body }));
} catch (error) { console.error(JSON.stringify({ error: error.message, cause: error.cause?.code })); process.exitCode = 1; }
