export type Tool = {
  id: string;
  name: string;
  description?: string;
  invoke: (...args: any[]) => Promise<any> | any;
};

export class ToolRegistry {
  private tools = new Map<string, Tool>();

  register(tool: Tool) {
    this.tools.set(tool.id, tool);
  }

  get(id: string) {
    return this.tools.get(id);
  }

  list() {
    return Array.from(this.tools.values());
  }
}

export const createToolRegistry = () => new ToolRegistry();
