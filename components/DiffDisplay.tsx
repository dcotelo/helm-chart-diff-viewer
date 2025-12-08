'use client';

import { useState, useEffect } from 'react';
import { CompareResponse } from '@/lib/types';

interface DiffDisplayProps {
  result: CompareResponse;
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
  
  // Split by --- separators (YAML document separators)
  const sections: string[] = [];
  let currentSection: string[] = [];
  
  for (const line of lines) {
    // Look for YAML document separator patterns
    if (line.trim() === '---' || line.match(/^---\s*$/)) {
      if (currentSection.length > 0) {
        sections.push(currentSection.join('\n'));
        currentSection = [];
      }
      currentSection.push(line);
    } else {
      currentSection.push(line);
    }
  }
  
  // Add last section
  if (currentSection.length > 0) {
    sections.push(currentSection.join('\n'));
  }
  
  // If no --- separators found, try splitting by blank lines + kind pattern
  if (sections.length === 1 && diff.includes('kind:')) {
    sections.length = 0;
    currentSection = [];
    let inResource = false;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      
      // New resource detected by kind: at start of line or after minimal indentation
      if (trimmed.toLowerCase().startsWith('kind:') || 
          (trimmed.match(/^[+-]?\s{0,4}kind:/i) && !inResource)) {
        if (inResource && currentSection.length > 0) {
          sections.push(currentSection.join('\n'));
        }
        currentSection = [];
        inResource = true;
      }
      
      currentSection.push(line);
      
      // Check if we've moved to a new resource (blank line + kind: or ---)
      if (trimmed === '' && i < lines.length - 1) {
        const nextLine = lines[i + 1].trim();
        if (nextLine.toLowerCase().startsWith('kind:') || nextLine === '---') {
          if (currentSection.length > 0) {
            sections.push(currentSection.join('\n'));
            currentSection = [];
            inResource = false;
          }
        }
      }
    }
    
    if (currentSection.length > 0) {
      sections.push(currentSection.join('\n'));
    }
  }
  
  // Parse each section
  for (const section of sections) {
    if (!section.trim()) continue;
    
    let kind: string | null = null;
    let name: string | null = null;
    let namespace: string | null = null;
    
    const sectionLines = section.split('\n');
    
    // Extract kind, name, namespace
    for (const line of sectionLines) {
      const trimmed = line.trim();
      
      // Extract kind (handle diff markers like +kind: or -kind: or just kind:)
      if (!kind && trimmed.match(/^[+-]?\s*kind:\s*(.+)$/i)) {
        const match = trimmed.match(/kind:\s*(.+)$/i);
        if (match) {
          kind = match[1].trim().replace(/["']/g, '');
        }
      }
      
      // Extract name (only if we found kind first, and name appears before other top-level keys)
      if (kind && !name && trimmed.match(/^[+-]?\s*name:\s*(.+)$/i)) {
        const match = trimmed.match(/name:\s*(.+)$/i);
        if (match) {
          name = match[1].trim().replace(/["']/g, '');
        }
      }
      
      // Extract namespace
      if (!namespace && trimmed.match(/^[+-]?\s*namespace:\s*(.+)$/i)) {
        const match = trimmed.match(/namespace:\s*(.+)$/i);
        if (match) {
          namespace = match[1].trim().replace(/["']/g, '');
        }
      }
    }
    
    // If we found at least a kind, create a resource entry
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

// Render diff lines with green/red colors
function renderDiffLine(line: string, index: number): JSX.Element {
  const trimmed = line.trim();
  const isHeader = line.startsWith('+++') || line.startsWith('---');
  const isAddition = line.startsWith('+') && !isHeader;
  const isRemoval = line.startsWith('-') && !isHeader;
  const isContext = !isAddition && !isRemoval && !isHeader;
  
  let bgColor = '#1e1e1e';
  let textColor = '#d4d4d4';
  let borderColor = 'transparent';
  let displayMarker = ' ';
  let displayContent = line;
  
  if (isAddition) {
    bgColor = '#1e4620'; // Dark green background
    textColor = '#9fdf9f'; // Light green text
    borderColor = '#4caf50'; // Green border
    displayMarker = '+';
    displayContent = line.substring(1); // Remove the + marker
  } else if (isRemoval) {
    bgColor = '#5c1a1a'; // Dark red background
    textColor = '#ff9999'; // Light red text
    borderColor = '#f44336'; // Red border
    displayMarker = '-';
    displayContent = line.substring(1); // Remove the - marker
  } else if (isHeader) {
    // Headers like +++ or --- should be displayed as-is
    displayContent = line;
    bgColor = '#2d2d2d';
    textColor = '#888';
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
        background: bgColor,
        color: textColor,
        borderLeft: `3px solid ${borderColor}`,
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

export function DiffDisplay({ result }: DiffDisplayProps) {
  const hasDiff = result.diff && result.diff.trim().length > 0;
  
  // Parse and group by kind
  const resources = hasDiff ? parseDiffByResources(result.diff || '') : [];
  const groupedByKind = groupResourcesByKind(resources);
  const kinds = Object.keys(groupedByKind).sort();
  
  // Initialize with all kinds expanded
  const [expandedKinds, setExpandedKinds] = useState<Set<string>>(new Set());
  // Track expanded individual resources: key format is "kind:name:namespace"
  const [expandedResources, setExpandedResources] = useState<Set<string>>(new Set());
  
  // Expand all kinds and resources when result changes
  useEffect(() => {
    if (kinds.length > 0) {
      setExpandedKinds(new Set(kinds));
      // Expand all resources by default
      const allResourceKeys = new Set<string>();
      resources.forEach(resource => {
        const key = `${resource.kind}:${resource.name}:${resource.namespace || 'default'}`;
        allResourceKeys.add(key);
      });
      setExpandedResources(allResourceKeys);
    } else {
      setExpandedKinds(new Set());
      setExpandedResources(new Set());
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
  
  const getResourceKey = (resource: ResourceDiff): string => {
    return `${resource.kind}:${resource.name}:${resource.namespace || 'default'}`;
  };
  
  const toggleResource = (resource: ResourceDiff) => {
    const key = getResourceKey(resource);
    setExpandedResources(prev => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
  };
  
  const expandAll = () => {
    setExpandedKinds(new Set(kinds));
    const allResourceKeys = new Set<string>();
    resources.forEach(resource => {
      allResourceKeys.add(getResourceKey(resource));
    });
    setExpandedResources(allResourceKeys);
  };
  
  const collapseAll = () => {
    setExpandedKinds(new Set());
    setExpandedResources(new Set());
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
                      
                      {/* Resources of this kind - collapsible */}
                      {isExpanded && (
                        <div>
                          {kindResources.map((resource, idx) => {
                            const resourceKey = getResourceKey(resource);
                            const isResourceExpanded = expandedResources.has(resourceKey);
                            
                            return (
                              <div key={idx} style={{
                                borderBottom: idx < kindResources.length - 1 ? '1px solid #333' : 'none'
                              }}>
                                {/* Resource header - collapsible */}
                                <div
                                  onClick={(e) => {
                                    e.stopPropagation(); // Don't toggle the kind when clicking resource
                                    toggleResource(resource);
                                  }}
                                  style={{
                                    padding: '0.5rem 1rem',
                                    background: '#2d2d2d',
                                    color: '#fff',
                                    fontSize: '0.85rem',
                                    borderBottom: '1px solid #444',
                                    cursor: 'pointer',
                                    userSelect: 'none',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    transition: 'background 0.2s'
                                  }}
                                  onMouseOver={(e) => {
                                    e.currentTarget.style.background = '#353535';
                                  }}
                                  onMouseOut={(e) => {
                                    e.currentTarget.style.background = '#2d2d2d';
                                  }}
                                >
                                  <span style={{ 
                                    fontSize: '0.75rem',
                                    transition: 'transform 0.2s',
                                    transform: isResourceExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                                    display: 'inline-block'
                                  }}>
                                    ▶
                                  </span>
                                  <span>
                                    <strong>Name:</strong> {resource.name}
                                    {resource.namespace && (
                                      <span style={{ marginLeft: '1rem', opacity: 0.8 }}>
                                        <strong>Namespace:</strong> {resource.namespace}
                                      </span>
                                    )}
                                  </span>
                                </div>
                                {/* Resource diff content - collapsible */}
                                {isResourceExpanded && (
                                  <div style={{
                                    background: '#1e1e1e',
                                    overflowX: 'auto'
                                  }}>
                                    {resource.lines.map((line, lineIdx) => 
                                      renderDiffLine(line, lineIdx)
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
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
