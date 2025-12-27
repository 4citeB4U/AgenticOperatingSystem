import { persistentRegistry } from './persistentRegistry';
import { ToolRegistry } from './registry/registry';
import { ToolSpec } from './toolSpec';

// very small placeholder validator — replace with AJV in production
export function validateAgainstSchema(payload: any, schema?: object) {
  if (!schema) return { ok: true };
  try {
    // basic: ensure required keys exist if schema has `required`
    const anySchema = schema as any;
    if (anySchema.required && Array.isArray(anySchema.required)) {
      for (const k of anySchema.required) if (!(k in payload)) return { ok: false, err: `missing ${k}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, err: String(e) };
  }
}

export class ToolDispatcher {
  constructor(private registry: ToolRegistry) {}

  async dispatch(toolId: string, input: any) {
    // resolve spec from in-memory registry first, then persistent
    const tool = this.registry.get(toolId);
    let spec: ToolSpec | undefined;
    if (tool) {
      spec = (tool as any).spec as ToolSpec;
    } else {
      spec = await persistentRegistry.get(toolId);
    }
    if (!spec) throw new Error(`Tool ${toolId} not found`);

    // policy / permissions checks would go here

    const v = validateAgainstSchema(input, spec.inputSchema);
    if (!v.ok) throw new Error(`Input validation failed: ${v.err}`);

    // execute based on runtime.adapter — only inline supported in this stub
    if ((spec.runtime.adapter === 'inline' || spec.runtime.adapter === 'dom')) {
      const impl = this.registry.get(toolId);
      if (!impl) throw new Error(`No runtime implementation registered for ${toolId}`);
      // `invoke` is expected on runtime tool object
      // @ts-ignore
      const res = await impl.invoke(input);
      // emit event into Memory Lake if observability requires it — placeholder
      try { (window as any).__AGENT_LEE_MEMORY_LAKE__?.appendEvent?.({
        id: Date.now().toString(), ts: Date.now(), sessionId: 'local', type: 'TOOL.EXEC', actor: 'agent', toolId: spec.id, payload: { input, output: res }
      }); } catch {}
      return res;
    }

    throw new Error('Runtime adapter not supported in stub');
  }
}

export const createDispatcher = (registry: ToolRegistry) => new ToolDispatcher(registry);
