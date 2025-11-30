'use client';

import { CompareRequest } from '@/lib/types';

interface DemoExample {
  name: string;
  description: string;
  data: CompareRequest;
}

const demoExamples: DemoExample[] = [
  {
    name: 'Example 1: Basic Chart Comparison',
    description: 'Compare the same branch (will show no differences, but demonstrates the tool)',
    data: {
      repository: 'https://github.com/helm/examples.git',
      chartPath: 'charts/nginx',
      version1: 'main',
      version2: 'main',
      valuesFile: 'values.yaml',
    }
  },
  {
    name: 'Example 2: With Custom Values',
    description: 'Use custom values content for comparison',
    data: {
      repository: 'https://github.com/helm/examples.git',
      chartPath: 'charts/nginx',
      version1: 'main',
      version2: 'main',
      valuesContent: `replicaCount: 3
image:
  repository: nginx
  tag: "1.21"
  pullPolicy: IfNotPresent
service:
  type: ClusterIP
  port: 80
resources:
  limits:
    cpu: 200m
    memory: 256Mi
  requests:
    cpu: 100m
    memory: 128Mi`
    }
  },
  {
    name: 'Example 3: Using Your Own Repository',
    description: 'Template - replace with your own repo URL, chart path, and versions',
    data: {
      repository: 'https://github.com/your-org/your-helm-charts.git',
      chartPath: 'charts/myapp',
      version1: 'main',
      version2: 'develop',
      valuesFile: 'values.yaml',
    }
  }
];

interface DemoExamplesProps {
  onSelectExample: (data: CompareRequest) => void;
}

export function DemoExamples({ onSelectExample }: DemoExamplesProps) {
  return (
    <div style={{
      marginBottom: '2rem',
      padding: '1.5rem',
      background: '#f8f9fa',
      borderRadius: '8px',
      border: '1px solid #e9ecef'
    }}>
      <h3 style={{
        fontSize: '1.25rem',
        marginBottom: '1rem',
        color: '#333',
        fontWeight: '600'
      }}>
        📚 Demo Examples
      </h3>
      <p style={{
        fontSize: '0.9rem',
        color: '#666',
        marginBottom: '1rem'
      }}>
        Try these pre-configured examples to see how the diff viewer works:
      </p>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem'
      }}>
        {demoExamples.map((example, index) => (
          <button
            key={index}
            onClick={() => onSelectExample(example.data)}
            style={{
              padding: '0.75rem 1rem',
              background: 'white',
              border: '1px solid #ddd',
              borderRadius: '6px',
              textAlign: 'left',
              cursor: 'pointer',
              transition: 'all 0.2s',
              fontSize: '0.9rem'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.background = '#f0f0f0';
              e.currentTarget.style.borderColor = '#667eea';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = 'white';
              e.currentTarget.style.borderColor = '#ddd';
            }}
          >
            <div style={{ fontWeight: '600', color: '#333', marginBottom: '0.25rem' }}>
              {example.name}
            </div>
            <div style={{ color: '#666', fontSize: '0.85rem' }}>
              {example.description}
            </div>
          </button>
        ))}
      </div>
      <div style={{
        marginTop: '1rem',
        padding: '0.75rem',
        background: '#e7f3ff',
        borderRadius: '6px',
        fontSize: '0.85rem',
        color: '#0066cc'
      }}>
        <strong>💡 Tip:</strong> These examples use public Helm chart repositories. 
        You can modify the values or use your own repository URLs.
      </div>
    </div>
  );
}

