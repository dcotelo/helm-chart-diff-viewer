'use client';

import React, { useState, FormEvent, useEffect, useCallback } from 'react';
import { CompareRequest } from '@/lib/types';

interface CompareFormProps {
  onSubmit: (data: CompareRequest) => void;
  loading: boolean;
  initialData?: CompareRequest;
}

interface VersionsResponse {
  success: boolean;
  tags?: string[];
  branches?: string[];
  error?: string;
}

const defaultFormData: CompareRequest = {
  repository: '',
  chartPath: 'charts/app',
  version1: '',
  version2: '',
  valuesFile: '',
  valuesContent: '',
  ignoreLabels: false
};

export function CompareForm({ onSubmit, loading, initialData }: CompareFormProps) {
  const [formData, setFormData] = useState<CompareRequest>(() => initialData || defaultFormData);
  const [versions, setVersions] = useState<string[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [versionsError, setVersionsError] = useState<string | null>(null);

  useEffect(() => {
    if (initialData) {
      setFormData({
        repository: initialData.repository || '',
        chartPath: initialData.chartPath || 'charts/app',
        version1: initialData.version1 || '',
        version2: initialData.version2 || '',
        valuesFile: initialData.valuesFile || '',
        valuesContent: initialData.valuesContent || '',
        ignoreLabels: initialData.ignoreLabels || false
      });
    } else {
      setFormData({ ...defaultFormData });
    }
  }, [initialData]);

  const fetchVersions = useCallback(async (repository: string) => {
    if (!repository || !repository.match(/^(https?:\/\/|git@)/)) {
      setVersions([]);
      setVersionsError(null);
      return;
    }

    setLoadingVersions(true);
    setVersionsError(null);

    try {
      const response = await fetch('/api/versions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ repository }),
      });

      const data: VersionsResponse = await response.json();

      if (data.success) {
        // Combine tags and branches, prioritizing tags
        const allVersions = [
          ...(data.tags || []),
          ...(data.branches || [])
        ].filter(v => v && v.trim().length > 0); // Filter out empty strings
        
        if (allVersions.length > 0) {
          setVersions(allVersions);
          setVersionsError(null);
        } else {
          setVersions([]);
          setVersionsError('No tags or branches found in repository');
        }
      } else {
        setVersions([]);
        setVersionsError(data.error || 'Failed to fetch versions');
      }
    } catch (error: any) {
      console.error('Error fetching versions:', error);
      setVersions([]);
      setVersionsError(error.message || 'Failed to fetch versions');
    } finally {
      setLoadingVersions(false);
    }
  }, []);

  // Debounce repository URL changes to fetch versions
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (formData.repository) {
        fetchVersions(formData.repository);
      } else {
        setVersions([]);
        setVersionsError(null);
      }
    }, 1000); // Wait 1 second after user stops typing

    return () => clearTimeout(timeoutId);
  }, [formData.repository, fetchVersions]);


  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5rem'
      }}>
      <div>
        <label style={{
          display: 'block',
          marginBottom: '0.5rem',
          fontWeight: '600',
          color: '#333'
        }}>
          Repository URL *
        </label>
        <input
          type="text"
          value={formData.repository}
          onChange={(e) => setFormData({ ...formData, repository: e.target.value })}
          placeholder="https://github.com/user/repo.git"
          required
          style={{
            width: '100%',
            padding: '0.75rem',
            border: '1px solid #ddd',
            borderRadius: '6px',
            fontSize: '1rem'
          }}
        />
      </div>

      <div>
        <label style={{
          display: 'block',
          marginBottom: '0.5rem',
          fontWeight: '600',
          color: '#333'
        }}>
          Chart Path *
        </label>
        <input
          type="text"
          value={formData.chartPath}
          onChange={(e) => setFormData({ ...formData, chartPath: e.target.value })}
          placeholder="charts/datadog or charts/datadog-operator"
          required
          style={{
            width: '100%',
            padding: '0.75rem',
            border: '1px solid #ddd',
            borderRadius: '6px',
            fontSize: '1rem'
          }}
        />
        <small style={{ color: '#666', fontSize: '0.875rem', display: 'block', marginTop: '0.25rem' }}>
          Path to the Helm chart directory within the repository. For monorepos, use patterns like:
          <br />
          <code style={{ fontSize: '0.8rem', background: '#f5f5f5', padding: '0.1rem 0.3rem', borderRadius: '3px' }}>
            charts/&lt;chart-name&gt;
          </code>
          {' '}(e.g., <code style={{ fontSize: '0.8rem', background: '#f5f5f5', padding: '0.1rem 0.3rem', borderRadius: '3px' }}>charts/datadog</code>)
        </small>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        <div>
          <label style={{
            display: 'block',
            marginBottom: '0.5rem',
            fontWeight: '600',
            color: '#333'
          }}>
            Version 1 (Tag/Commit) *
          </label>
          <div style={{ position: 'relative' }}>
            {loadingVersions ? (
              <div style={{
                position: 'relative',
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #ddd',
                borderRadius: '6px',
                fontSize: '1rem',
                backgroundColor: '#f5f5f5',
                color: '#999',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                cursor: 'not-allowed'
              }}>
                <span style={{
                  display: 'inline-block',
                  width: '16px',
                  height: '16px',
                  border: '2px solid #e0e0e0',
                  borderTopColor: '#667eea',
                  borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite',
                  flexShrink: 0
                }}></span>
                <span>Loading versions...</span>
              </div>
            ) : versions.length > 0 ? (
              <select
                value={formData.version1}
                onChange={(e) => setFormData({ ...formData, version1: e.target.value })}
                required
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #ddd',
                  borderRadius: '6px',
                  fontSize: '1rem',
                  backgroundColor: '#fff',
                  color: '#333',
                  cursor: 'pointer',
                  appearance: 'none',
                  backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 12 12\'%3E%3Cpath fill=\'%23666\' d=\'M6 9L1 4h10z\'/%3E%3C/svg%3E")',
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 0.75rem center',
                  paddingRight: '2.5rem'
                }}
              >
                <option value="">Select a version...</option>
                {versions.map((version, idx) => (
                  <option key={`v1-${idx}-${version}`} value={version}>
                    {version}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={formData.version1}
                onChange={(e) => setFormData({ ...formData, version1: e.target.value })}
                placeholder="Enter version manually"
                required
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #ddd',
                  borderRadius: '6px',
                  fontSize: '1rem',
                  backgroundColor: '#fff'
                }}
              />
            )}
          </div>
          {versionsError && (
            <small style={{ color: '#d32f2f', fontSize: '0.75rem', display: 'block', marginTop: '0.25rem' }}>
              {versionsError}
            </small>
          )}
          {versions.length > 0 && !versionsError && !loadingVersions && (
            <small style={{ color: '#666', fontSize: '0.75rem', display: 'block', marginTop: '0.25rem' }}>
              {versions.length} version{versions.length !== 1 ? 's' : ''} available
            </small>
          )}
        </div>

        <div>
          <label style={{
            display: 'block',
            marginBottom: '0.5rem',
            fontWeight: '600',
            color: '#333'
          }}>
            Version 2 (Tag/Commit) *
          </label>
          <div style={{ position: 'relative' }}>
            {loadingVersions ? (
              <div style={{
                position: 'relative',
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #ddd',
                borderRadius: '6px',
                fontSize: '1rem',
                backgroundColor: '#f5f5f5',
                color: '#999',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                cursor: 'not-allowed'
              }}>
                <span style={{
                  display: 'inline-block',
                  width: '16px',
                  height: '16px',
                  border: '2px solid #e0e0e0',
                  borderTopColor: '#667eea',
                  borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite',
                  flexShrink: 0
                }}></span>
                <span>Loading versions...</span>
              </div>
            ) : versions.length > 0 ? (
              <select
                value={formData.version2}
                onChange={(e) => setFormData({ ...formData, version2: e.target.value })}
                required
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #ddd',
                  borderRadius: '6px',
                  fontSize: '1rem',
                  backgroundColor: '#fff',
                  color: '#333',
                  cursor: 'pointer',
                  appearance: 'none',
                  backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 12 12\'%3E%3Cpath fill=\'%23666\' d=\'M6 9L1 4h10z\'/%3E%3C/svg%3E")',
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 0.75rem center',
                  paddingRight: '2.5rem'
                }}
              >
                <option value="">Select a version...</option>
                {versions.map((version, idx) => (
                  <option key={`v2-${idx}-${version}`} value={version}>
                    {version}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={formData.version2}
                onChange={(e) => setFormData({ ...formData, version2: e.target.value })}
                placeholder="Enter version manually"
                required
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #ddd',
                  borderRadius: '6px',
                  fontSize: '1rem',
                  backgroundColor: '#fff'
                }}
              />
            )}
          </div>
          {versionsError && (
            <small style={{ color: '#d32f2f', fontSize: '0.75rem', display: 'block', marginTop: '0.25rem' }}>
              {versionsError}
            </small>
          )}
          {versions.length > 0 && !versionsError && !loadingVersions && (
            <small style={{ color: '#666', fontSize: '0.75rem', display: 'block', marginTop: '0.25rem' }}>
              {versions.length} version{versions.length !== 1 ? 's' : ''} available
            </small>
          )}
        </div>
      </div>

      <div>
        <label style={{
          display: 'block',
          marginBottom: '0.5rem',
          fontWeight: '600',
          color: '#333'
        }}>
          Values File Path (Optional)
        </label>
        <input
          type="text"
          value={formData.valuesFile}
          onChange={(e) => setFormData({ ...formData, valuesFile: e.target.value })}
          placeholder="values/prod.yaml"
          style={{
            width: '100%',
            padding: '0.75rem',
            border: '1px solid #ddd',
            borderRadius: '6px',
            fontSize: '1rem'
          }}
        />
        <small style={{ color: '#666', fontSize: '0.875rem' }}>
          Path to values file within the repository (relative to repo root)
        </small>
      </div>

      <div>
        <label style={{
          display: 'block',
          marginBottom: '0.5rem',
          fontWeight: '600',
          color: '#333'
        }}>
          Or Paste Values Content (Optional)
        </label>
        <textarea
          value={formData.valuesContent}
          onChange={(e) => setFormData({ ...formData, valuesContent: e.target.value })}
          placeholder="replicaCount: 3&#10;image:&#10;  repository: nginx&#10;  tag: latest"
          rows={6}
          style={{
            width: '100%',
            padding: '0.75rem',
            border: '1px solid #ddd',
            borderRadius: '6px',
            fontSize: '1rem',
            fontFamily: 'monospace'
          }}
        />
        <small style={{ color: '#666', fontSize: '0.875rem' }}>
          YAML content for values file (takes precedence over values file path)
        </small>
      </div>

      <div>
        <label style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          cursor: 'pointer',
          userSelect: 'none'
        }}>
          <input
            type="checkbox"
            checked={formData.ignoreLabels || false}
            onChange={(e) => setFormData({ ...formData, ignoreLabels: e.target.checked })}
            style={{
              width: '18px',
              height: '18px',
              cursor: 'pointer'
            }}
          />
          <span style={{ fontWeight: '500', color: '#333' }}>
            Ignore metadata/tag updates
          </span>
        </label>
        <small style={{ color: '#666', fontSize: '0.875rem', display: 'block', marginTop: '0.25rem', marginLeft: '1.75rem' }}>
          Hide changes to labels and annotations (metadata updates that don&apos;t affect resource behavior)
        </small>
      </div>

      <button
        type="submit"
        disabled={loading}
        style={{
          padding: '0.875rem 2rem',
          background: loading ? '#ccc' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          border: 'none',
          borderRadius: '6px',
          fontSize: '1rem',
          fontWeight: '600',
          cursor: loading ? 'not-allowed' : 'pointer',
          transition: 'opacity 0.2s'
        }}
      >
        {loading ? 'Comparing...' : 'Compare Versions'}
      </button>
    </form>
  );
}

