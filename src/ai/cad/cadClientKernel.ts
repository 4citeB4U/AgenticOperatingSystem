export type CadModelSpec = {
  id: string;
  name?: string;
};

export class CadClientKernel {
  async listModels(): Promise<CadModelSpec[]> {
    // stub: return empty list
    return [];
  }

  async loadModel(id: string) {
    // stub: pretend to load model
    return { id, loaded: true };
  }
}

export const createCadClientKernel = () => new CadClientKernel();
