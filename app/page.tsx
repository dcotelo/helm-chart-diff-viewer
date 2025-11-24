'use client';

import { useState } from 'react';
import { CompareForm } from '@/components/CompareForm';
import { DiffDisplay } from '@/components/DiffDisplay';
import { DemoExamples } from '@/components/DemoExamples';
import { CompareResponse, CompareRequest } from '@/lib/types';

export default function Home() {
  const [result, setResult] = useState<CompareResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<CompareRequest | undefined>(undefined);

  const handleCompare = async (formData: CompareRequest) => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/compare', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data: CompareResponse = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to compare versions');
      }

      setResult(data);
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={{
      maxWidth: '1200px',
      margin: '0 auto',
      background: 'white',
      borderRadius: '12px',
      boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
      overflow: 'hidden'
    }}>
      <div style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        padding: '2rem',
        color: 'white'
      }}>
        <h1 style={{
          fontSize: '2.5rem',
          marginBottom: '0.5rem',
          fontWeight: 'bold'
        }}>
          🔍 Helm Chart Diff Viewer
        </h1>
        <p style={{
          fontSize: '1.1rem',
          opacity: 0.9
        }}>
          Compare differences between two Helm chart versions
        </p>
      </div>

      <div style={{ padding: '2rem' }}>
        <DemoExamples onSelectExample={(data) => {
          setFormData(data);
        }} />
        <CompareForm onSubmit={handleCompare} loading={loading} initialData={formData} />

        {error && (
          <div style={{
            marginTop: '1.5rem',
            padding: '1rem',
            background: '#fee',
            border: '1px solid #fcc',
            borderRadius: '8px',
            color: '#c33'
          }}>
            <strong>Error:</strong> {error}
          </div>
        )}

        {result && (
          <div style={{ marginTop: '2rem' }}>
            <DiffDisplay result={result} />
          </div>
        )}
      </div>
    </main>
  );
}

