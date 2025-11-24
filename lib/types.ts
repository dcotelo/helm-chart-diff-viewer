export interface CompareRequest {
  repository: string;
  chartPath: string;
  version1: string;
  version2: string;
  valuesFile?: string;
  valuesContent?: string;
}

export interface CompareResponse {
  success: boolean;
  diff?: string;
  error?: string;
  version1?: string;
  version2?: string;
}

export interface DiffResult {
  hasDiff: boolean;
  diff: string;
  error?: string;
}

