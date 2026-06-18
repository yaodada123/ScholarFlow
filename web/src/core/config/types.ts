export interface ModelConfig {
  basic: string[];
  reasoning: string[];
  vision?: string[];
  code?: string[];
}

export interface RagConfig {
  provider: string;
}

export interface DeerFlowConfig {
  rag: RagConfig;
  models: ModelConfig;
  skills?: Array<{
    id: string;
    name: string;
    description: string;
    required_sections?: string[];
    figure_suggestions?: string[];
  }>;
}
