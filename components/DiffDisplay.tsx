'use client';

import { useState, useEffect } from 'react';
import { CompareResponse } from '@/lib/types';

interface DiffDisplayProps {
  result: CompareResponse;
  ignoreLabels?: boolean;
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

// Categorize changes based on the path
function categorizeChange(path: string, kind: string): string {
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
  
  // Resource-specific groupings
  if (kind === 'Service') {
    return 'Services';
  }
  if (kind === 'Deployment' || kind === 'StatefulSet' || kind === 'DaemonSet') {
    return 'Workloads';
  }
  if (kind === 'ConfigMap' || kind === 'Secret') {
    return 'Configuration';
  }
  if (kind === 'Ingress') {
    return 'Ingress';
  }
  if (kind === 'ServiceAccount' || kind === 'Role' || kind === 'RoleBinding' || kind === 'ClusterRole' || kind === 'ClusterRoleBinding') {
    return 'RBAC';
  }
  if (kind === 'PersistentVolumeClaim' || kind === 'PersistentVolume') {
    return 'Storage';
  }
  
  // Default: group by kind
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
    'Container & Image',
    'Scaling',
    'Resources',
    'Service Configuration',
    'Networking',
    'Environment & Config',
    'Storage & Volumes',
    'Selectors & Matching',
    'Workloads',
    'Services',
    'Ingress',
    'Configuration',
    'Configuration Data',
    'RBAC',
    'Storage',
    'Spec Changes',
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


export function DiffDisplay({ result, ignoreLabels = false }: DiffDisplayProps) {
  const hasDiff = result.diff && result.diff.trim().length > 0;
  
  // Filter out label changes if ignoreLabels is true
  let filteredDiff = result.diff || '';
  if (ignoreLabels && filteredDiff) {
    const lines = filteredDiff.split('\n');
    const filteredLines: string[] = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      
      // Check if this line indicates a label change
      // Format: "metadata.labels.xxx  (resource)" or contains "metadata.labels"
      const isLabelChange = trimmed.includes('metadata.labels') || 
                            trimmed.match(/^metadata\.labels\./) ||
                            trimmed.includes('metadata.annotations');
      
      if (isLabelChange) {
        // Skip this entire section until we hit the next resource or blank line sequence
        let skipUntil = i + 1;
        let foundEnd = false;
        
        while (skipUntil < lines.length && !foundEnd) {
          const nextLine = lines[skipUntil];
          const nextTrimmed = nextLine.trim();
          
          if (nextTrimmed.match(/\([^)]+\)/) && !nextTrimmed.includes('metadata.labels') && !nextTrimmed.includes('metadata.annotations')) {
            foundEnd = true;
            i = skipUntil - 1;
            break;
          }
          
          if (nextTrimmed === '' && skipUntil + 1 < lines.length) {
            for (let k = skipUntil + 1; k < lines.length; k++) {
              const aheadTrimmed = lines[k].trim();
              if (aheadTrimmed === '') continue;
              
              if (aheadTrimmed.match(/\([^)]+\)/)) {
                if (!aheadTrimmed.includes('metadata.labels') && !aheadTrimmed.includes('metadata.annotations')) {
                  foundEnd = true;
                  i = k - 1;
                  break;
                }
              }
              break;
            }
          }
          
          skipUntil++;
        }
        
        i = skipUntil - 1;
      } else {
        filteredLines.push(line);
      }
    }
    
    filteredDiff = filteredLines.join('\n');
  }
  
  // Parse and group by category
  const resources = hasDiff ? parseDiffByResources(filteredDiff) : [];
  const groupedByCategory = groupResourcesByCategory(resources);
  const categories = Object.keys(groupedByCategory);
  
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
          {categories.length > 0 && (
            <div style={{ display: 'flex', gap: '0.5rem' }}>
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
            </div>
          )}
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
                {/* Executive Summary */}
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
