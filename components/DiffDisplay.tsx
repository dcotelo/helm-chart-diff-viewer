'use client';

import { useState, useEffect } from 'react';
import { CompareResponse } from '@/lib/types';

interface DiffDisplayProps {
  result: CompareResponse;
  ignoreLabels?: boolean;
}

interface ResourceDiff {
  kind: string;
  name: string;
  namespace?: string;
  diff: string;
  lines: string[];
}

// Color palette for different Kubernetes resource kinds
const kindColors: Record<string, { bg: string; border: string; text: string }> = {
  'Deployment': { bg: '#e3f2fd', border: '#2196f3', text: '#1565c0' },
  'Service': { bg: '#f3e5f5', border: '#9c27b0', text: '#6a1b9a' },
  'ConfigMap': { bg: '#fff3e0', border: '#ff9800', text: '#e65100' },
  'Secret': { bg: '#ffebee', border: '#f44336', text: '#c62828' },
  'Ingress': { bg: '#e8f5e9', border: '#4caf50', text: '#2e7d32' },
  'StatefulSet': { bg: '#e0f2f1', border: '#009688', text: '#00695c' },
  'DaemonSet': { bg: '#fff9c4', border: '#fbc02d', text: '#f57f17' },
  'Job': { bg: '#e1bee7', border: '#9c27b0', text: '#6a1b9a' },
  'CronJob': { bg: '#f8bbd0', border: '#e91e63', text: '#ad1457' },
  'PersistentVolumeClaim': { bg: '#b2ebf2', border: '#00bcd4', text: '#00838f' },
  'ServiceAccount': { bg: '#f1f8e9', border: '#8bc34a', text: '#558b2f' },
  'Role': { bg: '#e8eaf6', border: '#3f51b5', text: '#283593' },
  'RoleBinding': { bg: '#e8eaf6', border: '#3f51b5', text: '#283593' },
  'ClusterRole': { bg: '#ede7f6', border: '#673ab7', text: '#4527a0' },
  'ClusterRoleBinding': { bg: '#ede7f6', border: '#673ab7', text: '#4527a0' },
};

function getKindColor(kind: string): { bg: string; border: string; text: string } {
  return kindColors[kind] || { 
    bg: '#f5f5f5', 
    border: '#9e9e9e', 
    text: '#424242' 
  };
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
      
      // Start new resource
      currentResource = {
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
  // Split by --- separators (YAML document separators)
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
      kind: 'All Resources',
      name: 'all',
      diff: diff,
      lines: diff.split('\n')
    }];
  }
  
  return resources;
}

function groupResourcesByKind(resources: ResourceDiff[]): Record<string, ResourceDiff[]> {
  const grouped: Record<string, ResourceDiff[]> = {};
  
  for (const resource of resources) {
    if (!grouped[resource.kind]) {
      grouped[resource.kind] = [];
    }
    grouped[resource.kind].push(resource);
  }
  
  return grouped;
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
    let skipSection = false;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      
      // Check if this line indicates a label change (metadata.labels.*)
      if (trimmed.includes('metadata.labels') || trimmed.match(/labels\.[^)]+/)) {
        // Mark that we should skip this section
        skipSection = true;
        
        // Skip this line and all lines until we hit a blank line or a new resource identifier
        let j = i;
        while (j < lines.length) {
          const nextLine = lines[j];
          const nextTrimmed = nextLine.trim();
          
          // Stop skipping if we hit a blank line followed by a non-label resource identifier
          if (nextTrimmed === '' && j + 1 < lines.length) {
            const afterBlank = lines[j + 1].trim();
            // If next line is a resource identifier that's not a label, stop skipping
            if (afterBlank.match(/\([^)]+\)/) && !afterBlank.includes('metadata.labels')) {
              skipSection = false;
              i = j; // Continue from here
              break;
            }
          }
          
          // If we hit a new resource identifier that's not labels, stop skipping
          if (nextTrimmed.match(/\([^)]+\)/) && !nextTrimmed.includes('metadata.labels') && j > i) {
            skipSection = false;
            i = j - 1; // Go back one line to process this resource
            break;
          }
          
          // Stop at blank line (end of current section)
          if (nextTrimmed === '' && j > i) {
            skipSection = false;
            i = j - 1;
            break;
          }
          
          j++;
        }
        
        // Skip to the end of the section
        if (skipSection) {
          i = j - 1;
          skipSection = false;
        }
      } else {
        // Not a label change, include the line
        filteredLines.push(line);
      }
    }
    
    filteredDiff = filteredLines.join('\n');
  }
  
  // Parse and group by kind
  const resources = hasDiff ? parseDiffByResources(filteredDiff) : [];
  const groupedByKind = groupResourcesByKind(resources);
  const kinds = Object.keys(groupedByKind).sort();
  
  // Initialize with all kinds expanded
  const [expandedKinds, setExpandedKinds] = useState<Set<string>>(new Set());
  
  // Expand all kinds when result changes
  useEffect(() => {
    if (kinds.length > 0) {
      setExpandedKinds(new Set(kinds));
    } else {
      setExpandedKinds(new Set());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result.version1, result.version2]); // Expand when comparison changes
  
  const toggleKind = (kind: string) => {
    setExpandedKinds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(kind)) {
        newSet.delete(kind);
      } else {
        newSet.add(kind);
      }
      return newSet;
    });
  };
  
  const expandAll = () => {
    setExpandedKinds(new Set(kinds));
  };
  
  const collapseAll = () => {
    setExpandedKinds(new Set());
  };
  
  const allExpanded = expandedKinds.size === kinds.length && kinds.length > 0;
  const allCollapsed = expandedKinds.size === 0 && kinds.length > 0;

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
          {kinds.length > 0 && (
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
          {kinds.length > 0 && (
            <span>
              <strong>Resource Types:</strong> <code style={{
                background: '#e0e0e0',
                padding: '0.2rem 0.5rem',
                borderRadius: '4px'
              }}>{kinds.length} kind{kinds.length !== 1 ? 's' : ''}</code>
            </span>
          )}
        </div>
      </div>

      <div style={{ background: '#1e1e1e' }}>
        {hasDiff ? (
          <div>
            {kinds.length > 0 ? (
              // Grouped by kind view
              <div>
                {kinds.map((kind) => {
                  const kindResources = groupedByKind[kind];
                  const color = getKindColor(kind);
                  const isExpanded = expandedKinds.has(kind);
                  
                  return (
                    <div key={kind} style={{
                      borderBottom: '2px solid #444',
                      marginBottom: '1rem'
                    }}>
                      {/* Kind header - collapsible */}
                      <div 
                        onClick={() => toggleKind(kind)}
                        style={{
                          padding: '0.75rem 1rem',
                          background: color.bg,
                          borderBottom: `2px solid ${color.border}`,
                          color: color.text,
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
                        <span>{kind}</span>
                        <span style={{ 
                          fontSize: '0.85rem', 
                          opacity: 0.8,
                          marginLeft: 'auto'
                        }}>
                          ({kindResources.length} resource{kindResources.length !== 1 ? 's' : ''})
                        </span>
                      </div>
                      
                      {/* Resources of this kind */}
                      {isExpanded && (
                        <div>
                          {kindResources.map((resource, idx) => (
                            <div key={idx} style={{
                              borderBottom: idx < kindResources.length - 1 ? '1px solid #333' : 'none'
                            }}>
                              {/* Resource header */}
                              <div style={{
                                padding: '0.5rem 1rem',
                                background: '#2d2d2d',
                                color: '#fff',
                                fontSize: '0.85rem',
                                borderBottom: '1px solid #444'
                              }}>
                                <strong>Name:</strong> {resource.name}
                                {resource.namespace && (
                                  <span style={{ marginLeft: '1rem', opacity: 0.8 }}>
                                    <strong>Namespace:</strong> {resource.namespace}
                                  </span>
                                )}
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
              // Fallback to original view if parsing failed
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
