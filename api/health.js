// api/health.js  — provider health + circuit state. Standard serverless (not Edge).
import { getProviderHealth } from "./_lib/aiProviderManager.js";

export default function handler(req, res) {
  res.setHeader("Content-Type", "application/json");
  res.status(200).end(JSON.stringify({
    ok: true,
    time: new Date().toISOString(),
    providers: getProviderHealth(),
  }));
}
