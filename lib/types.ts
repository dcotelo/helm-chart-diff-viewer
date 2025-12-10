export interface CompareRequest {
  repository: string;
  chartPath: string;
  version1: string;
  version2: string;
  valuesFile?: string;
  valuesContent?: string;
  ignoreLabels?: boolean;
  normalizeManifests?: boolean;
  secretHandling?: 'suppress' | 'show' | 'decode';
  contextLines?: number;
  suppressKinds?: string[];
  suppressRegex?: string;
}

export interface CompareResponse {
  success: boolean;
  diff?: string;
  error?: string;
  version1?: string;
  version2?: string;
  statistics?: ChangeStatistics;
}

export interface DiffResult {
  hasDiff: boolean;
  diff: string;
  error?: string;
}

// Statistics interfaces
export interface ChangeStatistics {
  summary: ChangeSummary;
  byKind: ResourceStats[];
  byCategory: CategoryStats[];
  lines: LineStats;
  impact: ChangeImpact;
}

export interface ChangeSummary {
  totalResources: number;
  resourcesAdded: number;
  resourcesRemoved: number;
  resourcesModified: number;
  resourcesUnchanged: number;
  totalChanges: number;
}

export interface ResourceStats {
  kind: string;
  count: number;
  added: number;
  removed: number;
  modified: number;
}

export interface CategoryStats {
  category: string;
  count: number;
  resources: string[];
}

export interface LineStats {
  added: number;
  removed: number;
  unchanged: number;
  total: number;
}

export interface ChangeImpact {
  level: 'high' | 'medium' | 'low';
  criticalChanges: CriticalChange[];
  breakingChanges: BreakingChange[];
}

export interface CriticalChange {
  resource: string;
  kind: string;
  field: string;
  description: string;
}

export interface BreakingChange {
  resource: string;
  kind: string;
  field: string;
  description: string;
  severity: 'high' | 'medium' | 'low';
}

