# dispatch-node

Official **Dispatch GPU provider SDK** — connect your metal to the [Dispatch](https://runlayerlabs.xyz) orchestrator: heartbeats, health metrics, and (v1) job worker hooks over WebSocket.

Built for operators who run inference on their own GPUs (Permute-style provider loop, Dispatch network).

## Install

```bash
npm install dispatch-node
```

Until the package is on the public npm registry, install from GitHub:

```bash
npm install github:dispatch125x-sys/Dispatch
```

## Quick start

1. Dispatch registers your node and gives you **`node_id`** + **`node_secret`**.
2. Set env vars on the machine that runs your worker:

```bash
export DISPATCH_API_URL=https://your-orchestrator.onrender.com
export DISPATCH_NODE_ID=node_us_east_4090
export DISPATCH_NODE_SECRET=your_plaintext_secret
```

3. Heartbeat from Node:

```typescript
import { DispatchNodeClient, configFromEnv } from "dispatch-node";

const client = new DispatchNodeClient(configFromEnv());

client.startHeartbeat(() => ({
  latency_ms: 42,
  load_pct: Math.round(process.cpuUsage().user / 1e6) % 100,
}));

// When job stream is enabled on orchestrator:
client.onJob(async (job) => {
  // Run local inference (Ollama, vLLM, etc.) and return output
  return {
    output: { reply: `Handled ${job.agent_slug} on metal` },
    prompt_tokens: 100,
    completion_tokens: 50,
  };
});
client.connectJobStream();
```

## API

| Method | Description |
|--------|-------------|
| `heartbeat({ latency_ms?, load_pct? })` | `POST /v1/nodes/:id/heartbeat` with `x-node-secret` |
| `startHeartbeat(getMetrics?)` | Interval heartbeats (default 30s) |
| `onJob(handler)` | Register inference handler for WS jobs |
| `connectJobStream()` | Connect to orchestrator job WebSocket (retries) |
| `configFromEnv()` | Read `DISPATCH_API_URL`, `DISPATCH_NODE_ID`, `DISPATCH_NODE_SECRET` |

## Orchestrator endpoints (reference)

- Heartbeat: `POST /v1/nodes/:nodeId/heartbeat`
- Header: `x-node-secret: <secret>`
- Body (optional): `{ "latency_ms": 42, "load_pct": 55 }`

Network fleet visibility: Dispatch console → **Network**.

## Requirements

- Node.js **20+**
- Outbound HTTPS to orchestrator
- GPU stack you operate (Ollama, vLLM, custom) — wire inside `onJob`

## License

MIT © Dispatch Relay

## Links

- Product: [runlayerlabs.xyz](https://runlayerlabs.xyz)
- Docs: [runlayerlabs.xyz/docs](https://runlayerlabs.xyz/docs)
- Issues: [github.com/dispatch125x-sys/Dispatch/issues](https://github.com/dispatch125x-sys/Dispatch/issues)
