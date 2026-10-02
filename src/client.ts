import WebSocket from "ws";
import type {
  DispatchNodeConfig,
  DispatchRunJob,
  HeartbeatPayload,
  HeartbeatResult,
  JobHandler,
} from "./types.js";

export class DispatchNodeClient {
  private readonly apiUrl: string;
  private readonly nodeId: string;
  private readonly nodeSecret: string;
  private readonly heartbeatIntervalMs: number;
  private readonly wsPath: string;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private ws: WebSocket | null = null;
  private jobHandler: JobHandler | null = null;

  constructor(config: DispatchNodeConfig) {
    this.apiUrl = config.apiUrl.replace(/\/$/, "");
    this.nodeId = config.nodeId;
    this.nodeSecret = config.nodeSecret;
    this.heartbeatIntervalMs = config.heartbeatIntervalMs ?? 30_000;
    this.wsPath = config.wsPath ?? "/v1/nodes/ws";
  }

  /** POST /v1/nodes/:id/heartbeat */
  async heartbeat(payload: HeartbeatPayload = {}): Promise<HeartbeatResult> {
    const url = `${this.apiUrl}/v1/nodes/${encodeURIComponent(this.nodeId)}/heartbeat`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-node-secret": this.nodeSecret,
      },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      return { ok: true };
    }
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    return {
      ok: false,
      status: res.status,
      error: data.error ?? res.statusText,
    };
  }

  /** Start periodic heartbeats (call once on daemon boot). */
  startHeartbeat(getMetrics?: () => HeartbeatPayload): void {
    if (this.heartbeatTimer) return;
    const tick = () => {
      const payload = getMetrics?.() ?? {};
      void this.heartbeat(payload).then((r) => {
        if (!r.ok) {
          console.error("[dispatch-node] heartbeat failed", r.status, r.error);
        }
      });
    };
    tick();
    this.heartbeatTimer = setInterval(tick, this.heartbeatIntervalMs);
  }

  stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * Register handler for inference jobs. Connect WebSocket when orchestrator enables job stream.
   * Until then, connection may fail — heartbeats still mark the node online for routing visibility.
   */
  onJob(handler: JobHandler): void {
    this.jobHandler = handler;
  }

  /** Attempt WebSocket connect (v1 orchestrator). Safe to call; logs and retries on failure. */
  connectJobStream(options?: { reconnectMs?: number }): void {
    const reconnectMs = options?.reconnectMs ?? 10_000;
    const wsUrl = this.apiUrl.replace(/^http/, "ws") + this.wsPath;

    const connect = () => {
      try {
        this.ws = new WebSocket(wsUrl, {
          headers: {
            "x-node-secret": this.nodeSecret,
            "x-node-id": this.nodeId,
          },
        });
      } catch {
        setTimeout(connect, reconnectMs);
        return;
      }

      const socket = this.ws;
      if (!socket) return;

      socket.on("open", () => {
        console.info("[dispatch-node] job stream connected");
      });

      socket.on("message", (data) => {
        if (!this.jobHandler) return;
        try {
          const job = JSON.parse(String(data)) as DispatchRunJob;
          void this.jobHandler(job).then((result) => {
            socket.send(
              JSON.stringify({
                type: "job_result",
                run_id: job.run_id,
                output: result.output,
                prompt_tokens: result.prompt_tokens,
                completion_tokens: result.completion_tokens,
              }),
            );
          });
        } catch (e) {
          console.error("[dispatch-node] job parse/handle error", e);
        }
      });

      socket.on("close", () => {
        console.warn("[dispatch-node] job stream closed; reconnecting…");
        setTimeout(connect, reconnectMs);
      });

      socket.on("error", () => {
        socket.close();
      });
    };

    connect();
  }

  disconnect(): void {
    this.stopHeartbeat();
    this.ws?.close();
    this.ws = null;
  }
}

/** Load config from standard operator env vars. */
export function configFromEnv(): DispatchNodeConfig {
  const apiUrl = process.env.DISPATCH_API_URL?.trim();
  const nodeId = process.env.DISPATCH_NODE_ID?.trim();
  const nodeSecret = process.env.DISPATCH_NODE_SECRET?.trim();
  if (!apiUrl || !nodeId || !nodeSecret) {
    throw new Error(
      "Missing DISPATCH_API_URL, DISPATCH_NODE_ID, or DISPATCH_NODE_SECRET",
    );
  }
  return {
    apiUrl,
    nodeId,
    nodeSecret,
    heartbeatIntervalMs: process.env.DISPATCH_HEARTBEAT_MS
      ? Number(process.env.DISPATCH_HEARTBEAT_MS)
      : undefined,
  };
}
