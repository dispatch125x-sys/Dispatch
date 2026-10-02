export type DispatchNodeConfig = {
  /** Orchestrator base URL, e.g. https://runlayer-y9kc.onrender.com */
  apiUrl: string;
  /** Node id from Dispatch ops, e.g. node_us_east_4090 */
  nodeId: string;
  /** Plaintext heartbeat secret (sent as x-node-secret) */
  nodeSecret: string;
  /** Heartbeat interval ms (default 30_000) */
  heartbeatIntervalMs?: number;
  /** Optional WebSocket path for job stream (default /v1/nodes/ws — enable when orchestrator ships) */
  wsPath?: string;
};

export type HeartbeatPayload = {
  latency_ms?: number;
  load_pct?: number;
};

export type HeartbeatResult =
  | { ok: true }
  | { ok: false; status: number; error: string };

/** Future: run job dispatched from orchestrator over WebSocket */
export type DispatchRunJob = {
  run_id: string;
  agent_slug: string;
  model_tier: string;
  input: Record<string, unknown>;
};

export type JobHandler = (job: DispatchRunJob) => Promise<{
  output: Record<string, unknown>;
  prompt_tokens: number;
  completion_tokens: number;
}>;
