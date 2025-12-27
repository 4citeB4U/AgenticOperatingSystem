export type ToolId = string;
export type Semver = string;

export type PermissionSpec = {
  requiresUserGesture?: boolean;
  storage?: ('indexeddb' | 'opfs')[];
  compute?: ('webgpu' | 'wasm' | 'worker')[];
  devices?: ('microphone' | 'camera')[];
};

export type RuntimeSpec = {
  adapter: 'inline' | 'worker' | 'wasm' | 'dom' | 'webgpu';
  entry: string;
  timeoutMs?: number;
  concurrency?: number;
};

export type ObservabilitySpec = {
  emitsEvents: boolean;
  auditLevel: 'none' | 'basic' | 'full';
};

export type ToolSpec = {
  id: ToolId;
  version: Semver;
  title: string;
  description?: string;
  tags: string[];
  region: "🟢 CORE" | "🔵 UI" | "🧠 AI" | "💾 DATA" | "🟠 UTIL" | "🟣 MCP" | "🔴 SEO";
  inputSchema?: object;
  outputSchema?: object;
  permissions?: PermissionSpec;
  runtime: RuntimeSpec;
  observability?: ObservabilitySpec;
};
