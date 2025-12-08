'use client';

import React, { useState, FormEvent, useEffect } from 'react';
import { CompareRequest } from '@/lib/types';

interface CompareFormProps {
  onSubmit: (data: CompareRequest) => void;
  loading: boolean;
  initialData?: CompareRequest;
}

export function CompareForm({ onSubmit, loading, initialData }: CompareFormProps) {
  const defaultFormData: CompareRequest = {
    repository: '',
    chartPath: 'charts/app',
    version1: '',
    version2: '',
    valuesFile: '',
    valuesContent: '',
    ignoreLabels: false
  };

  const [formData, setFormData] = useState<CompareRequest>(() => initialData || defaultFormData);

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
          placeholder="charts/app"
          required
          style={{
            width: '100%',
            padding: '0.75rem',
            border: '1px solid #ddd',
            borderRadius: '6px',
            fontSize: '1rem'
          }}
        />
        <small style={{ color: '#666', fontSize: '0.875rem' }}>
          Path to the Helm chart directory within the repository
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
          <input
            type="text"
            value={formData.version1}
            onChange={(e) => setFormData({ ...formData, version1: e.target.value })}
            placeholder="v1.0.0"
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
            Version 2 (Tag/Commit) *
          </label>
          <input
            type="text"
            value={formData.version2}
            onChange={(e) => setFormData({ ...formData, version2: e.target.value })}
            placeholder="v1.1.0"
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
            Ignore label changes
          </span>
        </label>
        <small style={{ color: '#666', fontSize: '0.875rem', display: 'block', marginTop: '0.25rem', marginLeft: '1.75rem' }}>
          Filter out changes to metadata.labels in the diff output
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

