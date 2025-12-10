'use client';

import { useState, useEffect } from 'react';
import { CompareResponse, ChangeStatistics, ChangeSummary, ResourceStats, CategoryStats, LineStats, ChangeImpact, CriticalChange, BreakingChange } from '@/lib/types';

interface DiffDisplayProps {
  result: CompareResponse;
  ignoreLabels?: boolean;
  secretHandling?: 'suppress' | 'show' | 'decode';
  contextLines?: number;
  suppressKinds?: string[];
  suppressRegex?: string;
}

interface ResourceDiff {
  category: string;
  path: string;
  kind: string;
  name: string;
  namespace?: string;
  diff: string;
  lines: string[];
}

// Comprehensive mapping of Kubernetes resource kinds to categories
const RESOURCE_KIND_CATEGORIES: Record<string, string> = {
  // Workloads
  'Deployment': 'Workloads',
  'StatefulSet': 'Workloads',
  'DaemonSet': 'Workloads',
  'ReplicaSet': 'Workloads',
  'Job': 'Workloads',
  'CronJob': 'Workloads',
  'Pod': 'Workloads',
  
  // Services & Discovery
  'Service': 'Services',
  'Endpoints': 'Services',
  'EndpointSlice': 'Services',
  
  // Networking
  'Ingress': 'Networking',
  'IngressClass': 'Networking',
  'NetworkPolicy': 'Networking',
  
  // Storage
  'PersistentVolume': 'Storage',
  'PersistentVolumeClaim': 'Storage',
  'StorageClass': 'Storage',
  'VolumeAttachment': 'Storage',
  
  // Configuration
  'ConfigMap': 'Configuration',
  'Secret': 'Configuration',
  
  // RBAC
  'ServiceAccount': 'RBAC',
  'Role': 'RBAC',
  'RoleBinding': 'RBAC',
  'ClusterRole': 'RBAC',
  'ClusterRoleBinding': 'RBAC',
  
  // Policy
  'PodDisruptionBudget': 'Policy',
  'PodSecurityPolicy': 'Policy',
  'LimitRange': 'Policy',
  'ResourceQuota': 'Policy',
  'PriorityClass': 'Policy',
  
  // Autoscaling
  'HorizontalPodAutoscaler': 'Autoscaling',
  'VerticalPodAutoscaler': 'Autoscaling',
};

// Standard Kubernetes resource kinds (for detecting CRDs)
const STANDARD_KUBERNETES_KINDS = new Set([
  'Deployment', 'StatefulSet', 'DaemonSet', 'ReplicaSet', 'Job', 'CronJob', 'Pod',
  'Service', 'Endpoints', 'EndpointSlice',
  'Ingress', 'IngressClass', 'NetworkPolicy',
  'PersistentVolume', 'PersistentVolumeClaim', 'StorageClass', 'VolumeAttachment',
  'ConfigMap', 'Secret',
  'ServiceAccount', 'Role', 'RoleBinding', 'ClusterRole', 'ClusterRoleBinding',
  'PodDisruptionBudget', 'PodSecurityPolicy', 'LimitRange', 'ResourceQuota', 'PriorityClass',
  'HorizontalPodAutoscaler', 'VerticalPodAutoscaler',
  'Namespace', 'Node', 'Event', 'ComponentStatus', 'APIService',
  'CustomResourceDefinition', 'MutatingWebhookConfiguration', 'ValidatingWebhookConfiguration',
  'CertificateSigningRequest', 'Lease', 'CSIDriver', 'CSINode', 'CSIStorageCapacity',
  'FlowSchema', 'PriorityLevelConfiguration', 'RuntimeClass', 'PodTemplate',
]);

// Categorize changes based on the path and resource kind
function categorizeChange(path: string, kind: string): string {
  // First, check if we have a direct mapping for this resource kind
  if (kind && RESOURCE_KIND_CATEGORIES[kind]) {
    return RESOURCE_KIND_CATEGORIES[kind];
  }
  
  // Check if it's a Custom Resource (CRD) - not in standard kinds
  if (kind && !STANDARD_KUBERNETES_KINDS.has(kind)) {
    return 'Custom Resources';
  }
  
  const lowerPath = path.toLowerCase();
  
  // Metadata and tags (labels, annotations)
  if (lowerPath.includes('metadata.labels') || lowerPath.includes('metadata.annotations')) {
    return 'Metadata & Tags';
  }
  
  // Status changes (usually not meaningful for comparison)
  if (lowerPath.includes('.status.')) {
    return 'Status';
  }
  
  // Spec changes - actual configuration
  if (lowerPath.includes('.spec.')) {
    // Further categorize spec changes by type
    if (lowerPath.includes('.spec.containers') || lowerPath.includes('.spec.image') || lowerPath.includes('.spec.template')) {
      return 'Container & Image';
    }
    if (lowerPath.includes('.spec.replicas') || lowerPath.includes('.spec.scale')) {
      return 'Scaling';
    }
    if (lowerPath.includes('.spec.service') || lowerPath.includes('.spec.port') || lowerPath.includes('.spec.type')) {
      return 'Service Configuration';
    }
    if (lowerPath.includes('.spec.selector') || lowerPath.includes('.spec.matchlabels')) {
      return 'Selectors & Matching';
    }
    if (lowerPath.includes('.spec.resources') || lowerPath.includes('.spec.limits') || lowerPath.includes('.spec.requests')) {
      return 'Resources';
    }
    if (lowerPath.includes('.spec.env') || lowerPath.includes('.spec.configmap') || lowerPath.includes('.spec.secret')) {
      return 'Environment & Config';
    }
    if (lowerPath.includes('.spec.volume') || lowerPath.includes('.spec.persistentvolume')) {
      return 'Storage & Volumes';
    }
    if (lowerPath.includes('.spec.ingress') || lowerPath.includes('.spec.host') || lowerPath.includes('.spec.path')) {
      return 'Networking';
    }
    return 'Spec Changes';
  }
  
  // ConfigMap and Secret data
  if (lowerPath.includes('.data.') || lowerPath.includes('configmap') || lowerPath.includes('secret')) {
    return 'Configuration Data';
  }
  
  // Default: group by kind if we have one, otherwise "Other"
  return kind || 'Other';
}

function parseDiffByResources(diff: string): ResourceDiff[] {
  const resources: ResourceDiff[] = [];
  const lines = diff.split('\n');
  
  // Try to detect dyff format first (paths with resource identifiers in parentheses)
  // Format: "metadata.labels.helm.sh/chart  (v1/ServiceAccount/default/argocd-application-controller)"
  const dyffPattern = /\(([^)]+)\)/; // Matches (kind/namespace/name) or (apiVersion/kind/namespace/name)
  
  let currentResource: ResourceDiff | null = null;
  let currentSection: string[] = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    
    // Check if this line contains a resource identifier in parentheses (dyff format)
    const resourceMatch = trimmed.match(dyffPattern);
    if (resourceMatch) {
      // Save previous resource if exists
      if (currentResource && currentSection.length > 0) {
        currentResource.diff = currentSection.join('\n');
        currentResource.lines = [...currentSection];
        resources.push(currentResource);
      }
      
      // Parse resource identifier: format is either:
      // - kind/namespace/name
      // - apiVersion/kind/namespace/name
      const resourceParts = resourceMatch[1].split('/');
      let kind: string;
      let name: string;
      let namespace: string | undefined;
      
      if (resourceParts.length === 3) {
        // kind/namespace/name
        kind = resourceParts[0];
        namespace = resourceParts[1];
        name = resourceParts[2];
      } else if (resourceParts.length === 4) {
        // apiVersion/kind/namespace/name
        kind = resourceParts[1];
        namespace = resourceParts[2];
        name = resourceParts[3];
      } else {
        // Fallback: use first part as kind, last as name
        kind = resourceParts[0] || 'Unknown';
        name = resourceParts[resourceParts.length - 1] || 'unknown';
        namespace = resourceParts.length > 2 ? resourceParts[1] : undefined;
      }
      
      // Extract the path part (everything before the parentheses)
      const pathPart = trimmed.split('(')[0].trim();
      
      // Categorize the change
      const category = categorizeChange(pathPart, kind);
      
      // Start new resource
      currentResource = {
        category: category,
        path: pathPart,
        kind: kind,
        name: name,
        namespace: namespace === 'default' || namespace === '' ? undefined : namespace,
        diff: '',
        lines: []
      };
      
      // Include the header line in the section
      currentSection = [line];
    } else if (currentResource) {
      // We're in a resource section, collect lines until we hit another resource or end
      // Check if next non-empty line starts a new resource
      if (trimmed === '' && i < lines.length - 1) {
        // Look ahead to see if next non-empty line is a new resource
        let foundNextResource = false;
        for (let j = i + 1; j < lines.length; j++) {
          const nextLine = lines[j].trim();
          if (nextLine === '') continue;
          if (nextLine.match(dyffPattern)) {
            foundNextResource = true;
          }
          break;
        }
        
        if (foundNextResource) {
          // Save current resource and start new one
          currentResource.diff = currentSection.join('\n');
          currentResource.lines = [...currentSection];
          resources.push(currentResource);
          currentResource = null;
          currentSection = [];
          continue;
        }
      }
      
      currentSection.push(line);
    } else {
      // Not in a resource section and no resource detected - could be header or other content
      // Try to detect if this is traditional diff format
      if (trimmed.startsWith('+++') || trimmed.startsWith('---')) {
        // Traditional diff header, treat as single resource
        if (!currentResource) {
          currentResource = {
            category: 'Other',
            path: '',
            kind: 'Unknown',
            name: 'all',
            namespace: undefined,
            diff: '',
            lines: []
          };
        }
        currentSection.push(line);
      }
    }
  }
  
  // Save last resource
  if (currentResource && currentSection.length > 0) {
    currentResource.diff = currentSection.join('\n');
    currentResource.lines = [...currentSection];
    resources.push(currentResource);
  }
  
  // If we found resources using dyff format, return them
  if (resources.length > 0) {
    return resources;
  }
  
  // Fallback: Try traditional YAML diff format
  const sections: string[] = [];
  let currentSection2: string[] = [];
  
  for (const line of lines) {
    if (line.trim() === '---' || line.match(/^---\s*$/)) {
      if (currentSection2.length > 0) {
        sections.push(currentSection2.join('\n'));
        currentSection2 = [];
      }
      currentSection2.push(line);
    } else {
      currentSection2.push(line);
    }
  }
  
  if (currentSection2.length > 0) {
    sections.push(currentSection2.join('\n'));
  }
  
  // Parse YAML sections
  for (const section of sections) {
    if (!section.trim()) continue;
    
    let kind: string | null = null;
    let name: string | null = null;
    let namespace: string | null = null;
    
    const sectionLines = section.split('\n');
    
    for (const line of sectionLines) {
      const trimmed = line.trim();
      
      if (!kind && trimmed.match(/^[+-]?\s*kind:\s*(.+)$/i)) {
        const match = trimmed.match(/kind:\s*(.+)$/i);
        if (match) {
          kind = match[1].trim().replace(/["']/g, '');
        }
      }
      
      if (kind && !name && trimmed.match(/^[+-]?\s*name:\s*(.+)$/i)) {
        const match = trimmed.match(/name:\s*(.+)$/i);
        if (match) {
          name = match[1].trim().replace(/["']/g, '');
        }
      }
      
      if (!namespace && trimmed.match(/^[+-]?\s*namespace:\s*(.+)$/i)) {
        const match = trimmed.match(/namespace:\s*(.+)$/i);
        if (match) {
          namespace = match[1].trim().replace(/["']/g, '');
        }
      }
    }
    
    if (kind) {
      resources.push({
        category: categorizeChange('', kind),
        path: '',
        kind: kind,
        name: name || 'unknown',
        namespace: namespace || undefined,
        diff: section,
        lines: sectionLines
      });
    }
  }
  
  // If we couldn't parse into resources, return the whole diff as one entry
  if (resources.length === 0) {
    return [{
      category: 'All Changes',
      path: '',
      kind: 'All Resources',
      name: 'all',
      diff: diff,
      lines: diff.split('\n')
    }];
  }
  
  return resources;
}

function groupResourcesByCategory(resources: ResourceDiff[]): Record<string, ResourceDiff[]> {
  const grouped: Record<string, ResourceDiff[]> = {};
  
  // Define category order (most important first)
  const categoryOrder = [
    // Field-level changes (most specific)
    'Container & Image',
    'Scaling',
    'Resources',
    'Service Configuration',
    'Environment & Config',
    'Storage & Volumes',
    'Selectors & Matching',
    'Configuration Data',
    'Spec Changes',
    // Resource-level categories (grouped by type)
    'Workloads',
    'Services',
    'Networking',
    'Configuration',
    'Storage',
    'RBAC',
    'Policy',
    'Autoscaling',
    'Custom Resources',
    // Metadata and status (least important)
    'Metadata & Tags',
    'Status',
    'Other'
  ];
  
  for (const resource of resources) {
    if (!grouped[resource.category]) {
      grouped[resource.category] = [];
    }
    grouped[resource.category].push(resource);
  }
  
  // Sort categories by importance, then alphabetically for unmapped ones
  const sortedCategories = Object.keys(grouped).sort((a, b) => {
    const aIndex = categoryOrder.indexOf(a);
    const bIndex = categoryOrder.indexOf(b);
    
    if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
    if (aIndex !== -1) return -1;
    if (bIndex !== -1) return 1;
    return a.localeCompare(b);
  });
  
  const sorted: Record<string, ResourceDiff[]> = {};
  for (const cat of sortedCategories) {
    sorted[cat] = grouped[cat];
  }
  
  return sorted;
}

// Calculate statistics from parsed resources
function calculateStatistics(resources: ResourceDiff[], diff: string): ChangeStatistics {
  const summary: ChangeSummary = {
    totalResources: 0,
    resourcesAdded: 0,
    resourcesRemoved: 0,
    resourcesModified: 0,
    resourcesUnchanged: 0,
    totalChanges: resources.length
  };

  const kindMap = new Map<string, { added: number; removed: number; modified: number; count: number }>();
  const categoryMap = new Map<string, Set<string>>();
  const lineStats: LineStats = {
    added: 0,
    removed: 0,
    unchanged: 0,
    total: diff.split('\n').length
  };

  const criticalChanges: CriticalChange[] = [];
  const breakingChanges: BreakingChange[] = [];

  // Track unique resources by kind/name
  const resourceSet = new Set<string>();

  for (const resource of resources) {
    const resourceKey = `${resource.kind}/${resource.name}${resource.namespace ? `/${resource.namespace}` : ''}`;
    
    if (!resourceSet.has(resourceKey)) {
      resourceSet.add(resourceKey);
      summary.totalResources++;
    }

    // Update kind statistics
    if (!kindMap.has(resource.kind)) {
      kindMap.set(resource.kind, { added: 0, removed: 0, modified: 0, count: 0 });
    }
    const kindStats = kindMap.get(resource.kind)!;
    kindStats.count++;

    // Update category statistics
    if (!categoryMap.has(resource.category)) {
      categoryMap.set(resource.category, new Set());
    }
    categoryMap.get(resource.category)!.add(resourceKey);

    // Analyze diff lines
    let hasAdditions = false;
    let hasRemovals = false;
    let hasModifications = false;

    for (const line of resource.lines) {
      const trimmed = line.trim();
      
      if (trimmed.startsWith('+') && !trimmed.startsWith('+++')) {
        lineStats.added++;
        hasAdditions = true;
      } else if (trimmed.startsWith('-') && !trimmed.startsWith('---')) {
        lineStats.removed++;
        hasRemovals = true;
      } else if (trimmed && !trimmed.startsWith('+++') && !trimmed.startsWith('---')) {
        lineStats.unchanged++;
      }

      // Detect critical changes
      if (trimmed.includes('.spec.replicas')) {
        criticalChanges.push({
          resource: resourceKey,
          kind: resource.kind,
          field: 'replicas',
          description: 'Replica count changed'
        });
      }
      if (trimmed.includes('.spec.template.spec.containers') && trimmed.includes('image:')) {
        criticalChanges.push({
          resource: resourceKey,
          kind: resource.kind,
          field: 'image',
          description: 'Container image changed'
        });
      }
      if (trimmed.includes('.spec.resources')) {
        criticalChanges.push({
          resource: resourceKey,
          kind: resource.kind,
          field: 'resources',
          description: 'Resource limits/requests changed'
        });
      }

      // Detect breaking changes
      if (trimmed.startsWith('-') && !trimmed.startsWith('---')) {
        // Check if a required field is being removed
        if (trimmed.includes('required:') || trimmed.includes('requiredFields:')) {
          breakingChanges.push({
            resource: resourceKey,
            kind: resource.kind,
            field: resource.path,
            description: 'Required field removed',
            severity: 'high'
          });
        }
      }
    }

    // Determine change type
    if (hasAdditions && hasRemovals) {
      hasModifications = true;
      kindStats.modified++;
      summary.resourcesModified++;
    } else if (hasAdditions && !hasRemovals) {
      kindStats.added++;
      summary.resourcesAdded++;
    } else if (hasRemovals && !hasAdditions) {
      kindStats.removed++;
      summary.resourcesRemoved++;
    } else {
      summary.resourcesUnchanged++;
    }
  }

  // Convert kindMap to array
  const byKind: ResourceStats[] = Array.from(kindMap.entries()).map(([kind, stats]) => ({
    kind,
    count: stats.count,
    added: stats.added,
    removed: stats.removed,
    modified: stats.modified
  })).sort((a, b) => b.count - a.count);

  // Convert categoryMap to array
  const byCategory: CategoryStats[] = Array.from(categoryMap.entries()).map(([category, resourceSet]) => ({
    category,
    count: resourceSet.size,
    resources: Array.from(resourceSet)
  })).sort((a, b) => b.count - a.count);

  // Determine impact level
  let impactLevel: 'high' | 'medium' | 'low' = 'low';
  if (summary.resourcesRemoved > 0 || breakingChanges.length > 0 || criticalChanges.length > 5) {
    impactLevel = 'high';
  } else if (summary.resourcesModified > 0 || criticalChanges.length > 0) {
    impactLevel = 'medium';
  }

  const impact: ChangeImpact = {
    level: impactLevel,
    criticalChanges: criticalChanges.slice(0, 10), // Limit to top 10
    breakingChanges: breakingChanges.slice(0, 10)
  };

  return {
    summary,
    byKind,
    byCategory,
    lines: lineStats,
    impact
  };
}

// Export helper functions
function formatExportContent(format: 'text' | 'markdown', diff: string, result: CompareResponse, statistics: ChangeStatistics | null): string {
  const timestamp = new Date().toISOString();
  const header = format === 'markdown' 
    ? `# Helm Chart Diff Report\n\n` +
      `**Generated:** ${timestamp}\n` +
      `**Version 1:** ${result.version1 || 'N/A'}\n` +
      `**Version 2:** ${result.version2 || 'N/A'}\n\n`
    : `Helm Chart Diff Report\n` +
      `Generated: ${timestamp}\n` +
      `Version 1: ${result.version1 || 'N/A'}\n` +
      `Version 2: ${result.version2 || 'N/A'}\n\n`;

  let statsSection = '';
  if (statistics) {
    if (format === 'markdown') {
      statsSection = `## Statistics\n\n` +
        `### Summary\n` +
        `- Total Resources: ${statistics.summary.totalResources}\n` +
        `- Added: ${statistics.summary.resourcesAdded}\n` +
        `- Removed: ${statistics.summary.resourcesRemoved}\n` +
        `- Modified: ${statistics.summary.resourcesModified}\n` +
        `- Impact Level: ${statistics.impact.level.toUpperCase()}\n` +
        `- Lines: +${statistics.lines.added} / -${statistics.lines.removed}\n\n`;
      
      if (statistics.byKind.length > 0) {
        statsSection += `### Changes by Resource Kind\n\n`;
        statistics.byKind.slice(0, 10).forEach(stat => {
          statsSection += `- **${stat.kind}**: ${stat.count} (${stat.added > 0 ? `+${stat.added} ` : ''}${stat.removed > 0 ? `-${stat.removed} ` : ''}${stat.modified > 0 ? `~${stat.modified}` : ''})\n`;
        });
        statsSection += `\n`;
      }
      
      if (statistics.impact.criticalChanges.length > 0) {
        statsSection += `### Critical Changes\n\n`;
        statistics.impact.criticalChanges.forEach(change => {
          statsSection += `- **${change.resource}** (${change.kind}): ${change.field} - ${change.description}\n`;
        });
        statsSection += `\n`;
      }
      
      if (statistics.impact.breakingChanges.length > 0) {
        statsSection += `### Breaking Changes\n\n`;
        statistics.impact.breakingChanges.forEach(change => {
          statsSection += `- **${change.resource}** (${change.kind}) [${change.severity.toUpperCase()}]: ${change.field} - ${change.description}\n`;
        });
        statsSection += `\n`;
      }
    } else {
      statsSection = `STATISTICS\n` +
        `==========\n` +
        `Total Resources: ${statistics.summary.totalResources}\n` +
        `Added: ${statistics.summary.resourcesAdded}\n` +
        `Removed: ${statistics.summary.resourcesRemoved}\n` +
        `Modified: ${statistics.summary.resourcesModified}\n` +
        `Impact Level: ${statistics.impact.level.toUpperCase()}\n` +
        `Lines: +${statistics.lines.added} / -${statistics.lines.removed}\n\n`;
    }
  }

  const diffSection = format === 'markdown'
    ? `## Diff Output\n\n\`\`\`diff\n${diff}\n\`\`\``
    : `DIFF OUTPUT\n============\n\n${diff}`;

  return header + statsSection + diffSection;
}

function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Apply context lines to diff lines
function applyContextLines(lines: string[], contextLines: number): string[] {
  if (contextLines === undefined || contextLines < 0) {
    return lines;
  }
  
  const result: string[] = [];
  let lastChangeIndex = -1;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    const isChange = trimmed.startsWith('+') || trimmed.startsWith('-');
    
    if (isChange) {
      // Include context before this change
      const contextStart = Math.max(0, i - contextLines);
      const contextEnd = Math.min(lines.length, i + contextLines + 1);
      
      // Add context separator if needed
      if (lastChangeIndex >= 0 && contextStart > lastChangeIndex + 1) {
        result.push('...');
      }
      
      // Add context and change
      for (let j = contextStart; j < contextEnd; j++) {
        if (j >= lastChangeIndex + 1 || j === i) {
          result.push(lines[j]);
        }
      }
      
      lastChangeIndex = i;
    }
  }
  
  // If no changes found, return all lines
  if (result.length === 0) {
    return lines;
  }
  
  return result;
}

// Render diff lines without colors
function renderDiffLine(line: string, index: number): JSX.Element {
  const trimmed = line.trim();
  const isHeader = line.startsWith('+++') || line.startsWith('---');
  const isAddition = line.startsWith('+') && !isHeader;
  const isRemoval = line.startsWith('-') && !isHeader;
  
  let displayMarker = ' ';
  let displayContent = line;
  
  if (isAddition) {
    displayMarker = '+';
    displayContent = line.substring(1); // Remove the + marker
  } else if (isRemoval) {
    displayMarker = '-';
    displayContent = line.substring(1); // Remove the - marker
  } else if (isHeader) {
    // Headers like +++ or --- should be displayed as-is
    displayContent = line;
  } else {
    // Context lines (may start with space or have no marker)
    displayContent = line;
    displayMarker = ' ';
  }
  
  return (
    <div
      key={index}
      style={{
        padding: '0.25rem 1rem',
        background: '#1e1e1e',
        color: '#d4d4d4',
        fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
        fontSize: '0.875rem',
        lineHeight: '1.6',
        whiteSpace: 'pre',
        overflowX: 'auto'
      }}
    >
      <span style={{ opacity: 0.6, marginRight: '0.5rem', userSelect: 'none' }}>
        {displayMarker}
      </span>
      <span>{displayContent}</span>
    </div>
  );
}


export function DiffDisplay({ 
  result, 
  ignoreLabels = false,
  secretHandling = 'suppress',
  contextLines = 3,
  suppressKinds = [],
  suppressRegex
}: DiffDisplayProps) {
  const hasDiff = result.diff && result.diff.trim().length > 0;
  
  // Filter out ALL metadata changes if ignoreLabels is true
  // This filters ALL metadata.* fields, including:
  // - metadata.name, metadata.namespace, metadata.uid
  // - metadata.labels.* (all label changes including helm.sh/chart)
  // - metadata.annotations.* (all annotation changes)
  // - metadata.generation, metadata.resourceVersion, metadata.managedFields
  // - spec.template.metadata.* (nested metadata in pod templates)
  // Filtered changes are excluded from both display and statistics calculation
  let filteredDiff = result.diff || '';
  if (ignoreLabels && filteredDiff) {
    // Simple approach: remove all lines that are part of metadata blocks
    // A metadata block consists of:
    // 1. A line containing "metadata." with a resource identifier
    // 2. Following value change lines (starting with ±, +, or -)
    // 3. Blank lines until the next resource
    
    const lines = filteredDiff.split('\n');
    const filteredLines: string[] = [];
    let skipMode = false; // Are we currently skipping a metadata block?
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      const lowerLine = line.toLowerCase();
      
      // Check if this line starts a metadata block
      if (lowerLine.includes('metadata.') && line.match(/\([^)]+\/[^)]+\/[^)]+\)/)) {
        skipMode = true;
        // Skip this line
        continue;
      }
      
      // If we're in skip mode, check if we should stop skipping
      if (skipMode) {
        // Stop skipping if we hit a new non-metadata resource
        if (trimmed.match(/\([^)]+\/[^)]+\/[^)]+\)/)) {
          if (!lowerLine.includes('metadata.')) {
            // Found non-metadata resource, stop skipping
            skipMode = false;
            // Include this line
            filteredLines.push(line);
          }
          // If it's still metadata, continue skipping
          continue;
        }
        
        // Continue skipping value change indicator
        if (trimmed === '± value change') {
          continue;
        }
        
        // Continue skipping value lines
        if (trimmed.startsWith('-') || trimmed.startsWith('+')) {
          continue;
        }
        
        // Handle blank lines - look ahead to see what comes next
        if (trimmed === '') {
          // Look ahead to find next non-empty line
          for (let k = i + 1; k < lines.length && k < i + 5; k++) {
            const aheadLine = lines[k].trim();
            if (aheadLine === '') continue;
            
            // Check if it's a new resource
            if (aheadLine.match(/\([^)]+\/[^)]+\/[^)]+\)/)) {
              if (!lines[k].toLowerCase().includes('metadata.')) {
                // Found non-metadata resource, stop skipping at the blank line
                skipMode = false;
                // Include the blank line and continue processing
                break;
              }
              // Still metadata, continue skipping
              break;
            }
            // Not a resource, might be value line - continue skipping
            break;
          }
          // Skip the blank line
          continue;
        }
        
        // If we get here, we've encountered something unexpected
        // Assume we've left the metadata block
        skipMode = false;
        // Include this line
        filteredLines.push(line);
      }
      
      // Include the line if we're not skipping
      if (!skipMode) {
        filteredLines.push(line);
      }
    }
    
    filteredDiff = filteredLines.join('\n');
  }
  
  // Apply suppression filters
  let processedDiff = filteredDiff;
  
  // Suppress by resource kinds
  if (suppressKinds && suppressKinds.length > 0) {
    const lines = processedDiff.split('\n');
    const filtered: string[] = [];
    let skipResource = false;
    
    for (const line of lines) {
      // Check if this line starts a new resource
      const resourceMatch = line.match(/\(([^)]+)\)/);
      if (resourceMatch) {
        const resourceParts = resourceMatch[1].split('/');
        const kind = resourceParts.length >= 2 ? resourceParts[resourceParts.length - 3] || resourceParts[0] : resourceParts[0];
        skipResource = suppressKinds.some(sk => kind.toLowerCase() === sk.toLowerCase());
      }
      
      if (!skipResource) {
        filtered.push(line);
      }
    }
    
    processedDiff = filtered.join('\n');
  }
  
  // Suppress by regex
  if (suppressRegex) {
    try {
      const regex = new RegExp(suppressRegex);
      const lines = processedDiff.split('\n');
      processedDiff = lines.filter(line => !regex.test(line)).join('\n');
    } catch (e) {
      console.warn('Invalid suppress regex:', e);
    }
  }
  
  // Apply secret handling
  if (secretHandling === 'suppress') {
    // Redact secret values (basic implementation)
    processedDiff = processedDiff.replace(/data:\s*([^\n]+)/gi, (match, data) => {
      if (data.includes(':')) {
        return `data: [REDACTED]`;
      }
      return match;
    });
    processedDiff = processedDiff.replace(/value:\s*([^\n]+)/gi, (match, value) => {
      if (value.length > 20 || value.match(/^[A-Za-z0-9+/=]+$/)) {
        return `value: [REDACTED]`;
      }
      return match;
    });
  } else if (secretHandling === 'decode') {
    // Decode base64 secrets (basic implementation)
    processedDiff = processedDiff.replace(/value:\s*([A-Za-z0-9+/=]+)/g, (match, encoded) => {
      try {
        // Use atob for browser-compatible base64 decoding
        const decoded = atob(encoded);
        return `value: ${decoded} (decoded from base64)`;
      } catch {
        return match;
      }
    });
  }
  
  // Parse and group by category
  const resources = hasDiff ? parseDiffByResources(processedDiff) : [];
  
  // Apply context lines filtering to resource lines
  if (contextLines !== undefined && contextLines >= 0) {
    for (const resource of resources) {
      resource.lines = applyContextLines(resource.lines, contextLines);
    }
  }
  
  const groupedByCategory = groupResourcesByCategory(resources);
  const categories = Object.keys(groupedByCategory);
  
  // Calculate statistics from filtered diff (processedDiff)
  // This ensures that filtered changes (including ALL metadata.* fields) are not counted in statistics
  // processedDiff is the filtered version that excludes all metadata changes (name, namespace, labels, annotations, etc.)
  const statistics = hasDiff ? calculateStatistics(resources, processedDiff) : null;
  
  // Initialize with all categories expanded
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  
  // Expand all categories when result changes
  useEffect(() => {
    if (categories.length > 0) {
      setExpandedCategories(new Set(categories));
    } else {
      setExpandedCategories(new Set());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result.version1, result.version2]);
  
  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(category)) {
        newSet.delete(category);
      } else {
        newSet.add(category);
      }
      return newSet;
    });
  };
  
  const expandAll = () => {
    setExpandedCategories(new Set(categories));
  };
  
  const collapseAll = () => {
    setExpandedCategories(new Set());
  };
  
  const allExpanded = expandedCategories.size === categories.length && categories.length > 0;
  const allCollapsed = expandedCategories.size === 0 && categories.length > 0;

  return (
    <div style={{
      border: '1px solid #ddd',
      borderRadius: '8px',
      overflow: 'hidden'
    }}>
      <div style={{
        background: '#f5f5f5',
        padding: '1rem',
        borderBottom: '1px solid #ddd'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '0.5rem',
          flexWrap: 'wrap',
          gap: '0.5rem'
        }}>
          <h2 style={{
            fontSize: '1.5rem',
            margin: 0,
            color: '#333'
          }}>
            Comparison Results
          </h2>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {categories.length > 0 && (
              <>
                <button
                  onClick={expandAll}
                  disabled={allExpanded}
                  style={{
                    padding: '0.4rem 0.8rem',
                    background: allExpanded ? '#ccc' : '#667eea',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: allExpanded ? 'not-allowed' : 'pointer',
                    fontSize: '0.85rem',
                    opacity: allExpanded ? 0.5 : 1
                  }}
                >
                  Expand All
                </button>
                <button
                  onClick={collapseAll}
                  disabled={allCollapsed}
                  style={{
                    padding: '0.4rem 0.8rem',
                    background: allCollapsed ? '#ccc' : '#667eea',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: allCollapsed ? 'not-allowed' : 'pointer',
                    fontSize: '0.85rem',
                    opacity: allCollapsed ? 0.5 : 1
                  }}
                >
                  Collapse All
                </button>
              </>
            )}
            {hasDiff && (
              <>
                <button
                  onClick={() => {
                    const content = formatExportContent('text', processedDiff, result, statistics);
                    downloadFile(content, 'diff.txt', 'text/plain');
                  }}
                  style={{
                    padding: '0.4rem 0.8rem',
                    background: '#4caf50',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '0.85rem'
                  }}
                  title="Download as text file"
                >
                  📥 Export TXT
                </button>
                <button
                  onClick={() => {
                    const content = formatExportContent('markdown', processedDiff, result, statistics);
                    downloadFile(content, 'diff.md', 'text/markdown');
                  }}
                  style={{
                    padding: '0.4rem 0.8rem',
                    background: '#2196f3',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '0.85rem'
                  }}
                  title="Download as markdown file"
                >
                  📥 Export MD
                </button>
                <button
                  onClick={async () => {
                    const content = formatExportContent('text', processedDiff, result, statistics);
                    try {
                      await navigator.clipboard.writeText(content);
                      alert('Diff copied to clipboard!');
                    } catch (err) {
                      alert('Failed to copy to clipboard');
                    }
                  }}
                  style={{
                    padding: '0.4rem 0.8rem',
                    background: '#9c27b0',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '0.85rem'
                  }}
                  title="Copy to clipboard"
                >
                  📋 Copy
                </button>
              </>
            )}
          </div>
        </div>
        <div style={{
          display: 'flex',
          gap: '1rem',
          fontSize: '0.9rem',
          color: '#666',
          flexWrap: 'wrap'
        }}>
          <span>
            <strong>Version 1:</strong> <code style={{
              background: '#e0e0e0',
              padding: '0.2rem 0.5rem',
              borderRadius: '4px'
            }}>{result.version1}</code>
          </span>
          <span>
            <strong>Version 2:</strong> <code style={{
              background: '#e0e0e0',
              padding: '0.2rem 0.5rem',
              borderRadius: '4px'
            }}>{result.version2}</code>
          </span>
          {categories.length > 0 && (
            <span>
              <strong>Categories:</strong> <code style={{
                background: '#e0e0e0',
                padding: '0.2rem 0.5rem',
                borderRadius: '4px'
              }}>{categories.length} categorie{categories.length !== 1 ? 's' : ''}</code>
            </span>
          )}
        </div>
      </div>

      <div style={{ background: '#1e1e1e' }}>
        {hasDiff ? (
          <div>
            {categories.length > 0 ? (
              <div>
                {/* Enhanced Statistics Dashboard */}
                {statistics && (
                  <div style={{
                    padding: '1.5rem',
                    background: '#2d2d2d',
                    borderBottom: '2px solid #444',
                    marginBottom: '1rem'
                  }}>
                    <h3 style={{
                      fontSize: '1.25rem',
                      fontWeight: '600',
                      color: '#fff',
                      marginBottom: '1rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem'
                    }}>
                      <span>📊</span> Enhanced Statistics Dashboard
                    </h3>
                    
                    {/* Summary Cards */}
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                      gap: '1rem',
                      marginBottom: '1.5rem'
                    }}>
                      <div style={{
                        padding: '1rem',
                        background: '#1e1e1e',
                        borderRadius: '6px',
                        border: '1px solid #444'
                      }}>
                        <div style={{ fontSize: '0.85rem', color: '#888', marginBottom: '0.25rem' }}>
                          Total Resources
                        </div>
                        <div style={{ fontSize: '1.5rem', fontWeight: '600', color: '#fff' }}>
                          {statistics.summary.totalResources}
                        </div>
                      </div>
                      
                      <div style={{
                        padding: '1rem',
                        background: '#1e1e1e',
                        borderRadius: '6px',
                        border: '1px solid #444'
                      }}>
                        <div style={{ fontSize: '0.85rem', color: '#888', marginBottom: '0.25rem' }}>
                          Added
                        </div>
                        <div style={{ fontSize: '1.5rem', fontWeight: '600', color: '#4caf50' }}>
                          {statistics.summary.resourcesAdded}
                        </div>
                      </div>
                      
                      <div style={{
                        padding: '1rem',
                        background: '#1e1e1e',
                        borderRadius: '6px',
                        border: '1px solid #444'
                      }}>
                        <div style={{ fontSize: '0.85rem', color: '#888', marginBottom: '0.25rem' }}>
                          Removed
                        </div>
                        <div style={{ fontSize: '1.5rem', fontWeight: '600', color: '#f44336' }}>
                          {statistics.summary.resourcesRemoved}
                        </div>
                      </div>
                      
                      <div style={{
                        padding: '1rem',
                        background: '#1e1e1e',
                        borderRadius: '6px',
                        border: '1px solid #444'
                      }}>
                        <div style={{ fontSize: '0.85rem', color: '#888', marginBottom: '0.25rem' }}>
                          Modified
                        </div>
                        <div style={{ fontSize: '1.5rem', fontWeight: '600', color: '#ff9800' }}>
                          {statistics.summary.resourcesModified}
                        </div>
                      </div>
                      
                      <div style={{
                        padding: '1rem',
                        background: '#1e1e1e',
                        borderRadius: '6px',
                        border: '1px solid #444'
                      }}>
                        <div style={{ fontSize: '0.85rem', color: '#888', marginBottom: '0.25rem' }}>
                          Impact Level
                        </div>
                        <div style={{ 
                          fontSize: '1.5rem', 
                          fontWeight: '600', 
                          color: statistics.impact.level === 'high' ? '#f44336' : 
                                 statistics.impact.level === 'medium' ? '#ff9800' : '#4caf50'
                        }}>
                          {statistics.impact.level.toUpperCase()}
                        </div>
                      </div>
                      
                      <div style={{
                        padding: '1rem',
                        background: '#1e1e1e',
                        borderRadius: '6px',
                        border: '1px solid #444'
                      }}>
                        <div style={{ fontSize: '0.85rem', color: '#888', marginBottom: '0.25rem' }}>
                          Lines Changed
                        </div>
                        <div style={{ fontSize: '1.5rem', fontWeight: '600', color: '#fff' }}>
                          +{statistics.lines.added} / -{statistics.lines.removed}
                        </div>
                      </div>
                    </div>
                    
                    {/* Changes by Resource Kind */}
                    {statistics.byKind.length > 0 && (
                      <div style={{ marginBottom: '1.5rem' }}>
                        <h4 style={{ fontSize: '1rem', fontWeight: '600', color: '#fff', marginBottom: '0.75rem' }}>
                          Changes by Resource Kind
                        </h4>
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                          gap: '0.5rem'
                        }}>
                          {statistics.byKind.slice(0, 10).map((stat) => (
                            <div key={stat.kind} style={{
                              padding: '0.75rem',
                              background: '#1e1e1e',
                              borderRadius: '4px',
                              border: '1px solid #444',
                              fontSize: '0.875rem'
                            }}>
                              <div style={{ color: '#fff', fontWeight: '600', marginBottom: '0.25rem' }}>
                                {stat.kind}
                              </div>
                              <div style={{ color: '#888', fontSize: '0.75rem' }}>
                                Total: {stat.count} | 
                                {stat.added > 0 && <span style={{ color: '#4caf50' }}> +{stat.added}</span>}
                                {stat.removed > 0 && <span style={{ color: '#f44336' }}> -{stat.removed}</span>}
                                {stat.modified > 0 && <span style={{ color: '#ff9800' }}> ~{stat.modified}</span>}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* Critical Changes */}
                    {statistics.impact.criticalChanges.length > 0 && (
                      <div style={{ marginBottom: '1.5rem' }}>
                        <h4 style={{ fontSize: '1rem', fontWeight: '600', color: '#fff', marginBottom: '0.75rem' }}>
                          ⚠️ Critical Changes
                        </h4>
                        <div style={{
                          background: '#1e1e1e',
                          borderRadius: '4px',
                          border: '1px solid #ff9800',
                          padding: '0.75rem',
                          maxHeight: '200px',
                          overflowY: 'auto'
                        }}>
                          {statistics.impact.criticalChanges.map((change, idx) => (
                            <div key={idx} style={{
                              padding: '0.5rem',
                              borderBottom: idx < statistics.impact.criticalChanges.length - 1 ? '1px solid #333' : 'none',
                              fontSize: '0.875rem'
                            }}>
                              <div style={{ color: '#fff', fontWeight: '500' }}>
                                {change.resource} ({change.kind})
                              </div>
                              <div style={{ color: '#888', fontSize: '0.75rem', marginTop: '0.25rem' }}>
                                {change.field}: {change.description}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* Breaking Changes */}
                    {statistics.impact.breakingChanges.length > 0 && (
                      <div style={{ marginBottom: '1.5rem' }}>
                        <h4 style={{ fontSize: '1rem', fontWeight: '600', color: '#f44336', marginBottom: '0.75rem' }}>
                          🚨 Breaking Changes
                        </h4>
                        <div style={{
                          background: '#1e1e1e',
                          borderRadius: '4px',
                          border: '1px solid #f44336',
                          padding: '0.75rem',
                          maxHeight: '200px',
                          overflowY: 'auto'
                        }}>
                          {statistics.impact.breakingChanges.map((change, idx) => (
                            <div key={idx} style={{
                              padding: '0.5rem',
                              borderBottom: idx < statistics.impact.breakingChanges.length - 1 ? '1px solid #333' : 'none',
                              fontSize: '0.875rem'
                            }}>
                              <div style={{ color: '#fff', fontWeight: '500' }}>
                                {change.resource} ({change.kind}) - <span style={{ 
                                  color: change.severity === 'high' ? '#f44336' : 
                                         change.severity === 'medium' ? '#ff9800' : '#4caf50'
                                }}>{change.severity.toUpperCase()}</span>
                              </div>
                              <div style={{ color: '#888', fontSize: '0.75rem', marginTop: '0.25rem' }}>
                                {change.field}: {change.description}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                
                {/* Legacy Summary (if no statistics) */}
                {!statistics && categories.length > 0 && (
                  <div style={{
                    padding: '1.5rem',
                    background: '#2d2d2d',
                    borderBottom: '2px solid #444',
                    marginBottom: '1rem'
                  }}>
                    <h3 style={{
                      fontSize: '1.25rem',
                      fontWeight: '600',
                      color: '#fff',
                      marginBottom: '1rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem'
                    }}>
                      <span>📊</span> Executive Summary
                    </h3>
                    
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                      gap: '1rem',
                      marginBottom: '1rem'
                    }}>
                      <div style={{
                        padding: '1rem',
                        background: '#1e1e1e',
                        borderRadius: '6px',
                        border: '1px solid #444'
                      }}>
                        <div style={{ fontSize: '0.85rem', color: '#888', marginBottom: '0.25rem' }}>
                          Total Changes
                        </div>
                        <div style={{ fontSize: '1.5rem', fontWeight: '600', color: '#fff' }}>
                          {resources.length}
                        </div>
                      </div>
                      
                      <div style={{
                        padding: '1rem',
                        background: '#1e1e1e',
                        borderRadius: '6px',
                        border: '1px solid #444'
                      }}>
                        <div style={{ fontSize: '0.85rem', color: '#888', marginBottom: '0.25rem' }}>
                          Categories
                        </div>
                        <div style={{ fontSize: '1.5rem', fontWeight: '600', color: '#fff' }}>
                          {categories.length}
                        </div>
                      </div>
                      
                      <div style={{
                        padding: '1rem',
                        background: '#1e1e1e',
                        borderRadius: '6px',
                        border: '1px solid #444'
                      }}>
                        <div style={{ fontSize: '0.85rem', color: '#888', marginBottom: '0.25rem' }}>
                          Resources Affected
                        </div>
                        <div style={{ fontSize: '1.5rem', fontWeight: '600', color: '#fff' }}>
                          {new Set(resources.map(r => `${r.kind}/${r.name}`)).size}
                        </div>
                      </div>
                    </div>
                    
                    {/* Category Breakdown */}
                    <div style={{ marginTop: '1rem' }}>
                      <div style={{ fontSize: '0.9rem', fontWeight: '500', color: '#ccc', marginBottom: '0.75rem' }}>
                        Changes by Category:
                      </div>
                      <div style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '0.5rem'
                      }}>
                        {categories.map((category) => {
                          const count = groupedByCategory[category].length;
                          const isImportant = !category.includes('Metadata') && !category.includes('Status') && !category.includes('Tags');
                          
                          return (
                            <div
                              key={category}
                              style={{
                                padding: '0.5rem 0.75rem',
                                background: '#1e1e1e',
                                border: '1px solid #444',
                                borderRadius: '4px',
                                fontSize: '0.85rem',
                                color: '#ccc',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem'
                              }}
                            >
                              <span style={{ fontWeight: '600' }}>{category}:</span>
                              <span style={{ 
                                background: '#444',
                                color: '#fff',
                                padding: '0.1rem 0.4rem',
                                borderRadius: '3px',
                                fontSize: '0.75rem',
                                fontWeight: '600'
                              }}>
                                {count}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    
                    {/* Key Changes Highlight */}
                    {resources.some(r => !r.category.includes('Metadata') && !r.category.includes('Status') && !r.category.includes('Tags')) && (
                      <div style={{
                        marginTop: '1rem',
                        padding: '0.75rem',
                        background: '#1e4620',
                        border: '1px solid #4caf50',
                        borderRadius: '6px',
                        fontSize: '0.9rem',
                        color: '#9fdf9f'
                      }}>
                        <strong>⚠️ Important:</strong> This comparison includes functional changes that may affect resource behavior.
                      </div>
                    )}
                  </div>
                )}
                
                {/* Categories */}
                {categories.map((category) => {
                  const categoryResources = groupedByCategory[category];
                  const isExpanded = expandedCategories.has(category);
                  
                  return (
                    <div key={category} style={{
                      borderBottom: '2px solid #444',
                      marginBottom: '1rem'
                    }}>
                      {/* Category header - collapsible */}
                      <div 
                        onClick={() => toggleCategory(category)}
                        style={{
                          padding: '0.75rem 1rem',
                          background: '#2d2d2d',
                          borderBottom: '2px solid #444',
                          color: '#fff',
                          fontSize: '0.95rem',
                          fontWeight: '600',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          cursor: 'pointer',
                          userSelect: 'none',
                          transition: 'background 0.2s'
                        }}
                        onMouseOver={(e) => {
                          e.currentTarget.style.opacity = '0.9';
                        }}
                        onMouseOut={(e) => {
                          e.currentTarget.style.opacity = '1';
                        }}
                      >
                        <span style={{ 
                          fontSize: '1rem',
                          transition: 'transform 0.2s',
                          transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                          display: 'inline-block'
                        }}>
                          ▶
                        </span>
                        <span style={{ fontSize: '1.1rem' }}>📦</span>
                        <span>{category}</span>
                        <span style={{ 
                          fontSize: '0.85rem', 
                          opacity: 0.8,
                          marginLeft: 'auto'
                        }}>
                          ({categoryResources.length} change{categoryResources.length !== 1 ? 's' : ''})
                        </span>
                      </div>
                      
                      {/* Resources in this category */}
                      {isExpanded && (
                        <div>
                          {categoryResources.map((resource, idx) => (
                            <div key={idx} style={{
                              borderBottom: idx < categoryResources.length - 1 ? '1px solid #333' : 'none'
                            }}>
                              {/* Resource header */}
                              <div style={{
                                padding: '0.5rem 1rem',
                                background: '#2d2d2d',
                                color: '#fff',
                                fontSize: '0.85rem',
                                borderBottom: '1px solid #444'
                              }}>
                                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                                  <span><strong>Resource:</strong> {resource.kind}/{resource.name}</span>
                                  {resource.namespace && (
                                    <span style={{ opacity: 0.8 }}>
                                      <strong>Namespace:</strong> {resource.namespace}
                                    </span>
                                  )}
                                  {resource.path && (
                                    <span style={{ opacity: 0.8 }}>
                                      <strong>Path:</strong> <code style={{ fontSize: '0.8rem' }}>{resource.path}</code>
                                    </span>
                                  )}
                                </div>
                              </div>
                              {/* Resource diff content */}
                              <div style={{
                                background: '#1e1e1e',
                                overflowX: 'auto'
                              }}>
                                {resource.lines.map((line, lineIdx) => 
                                  renderDiffLine(line, lineIdx)
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div>
                <div style={{
                  padding: '0.75rem 1rem',
                  background: '#2d2d2d',
                  borderBottom: '1px solid #444',
                  color: '#fff',
                  fontSize: '0.9rem'
                }}>
                  ⚠️ Differences detected
                </div>
                <div style={{
                  background: '#1e1e1e',
                  overflowX: 'auto'
                }}>
                  {(result.diff || '').split('\n').map((line, idx) => 
                    renderDiffLine(line, idx)
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div style={{
            padding: '2rem',
            textAlign: 'center',
            color: '#4caf50',
            fontSize: '1.1rem'
          }}>
            ✅ No differences found between versions
          </div>
        )}
      </div>
    </div>
  );
}
