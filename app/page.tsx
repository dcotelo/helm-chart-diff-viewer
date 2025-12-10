'use client';

import { useState } from 'react';
import { CompareForm } from '@/components/CompareForm';
import { DiffDisplay } from '@/components/DiffDisplay';
import { DemoExamples } from '@/components/DemoExamples';
import { ProgressIndicator } from '@/components/ProgressIndicator';
import { CompareResponse, CompareRequest } from '@/lib/types';

export default function Home() {
  const [result, setResult] = useState<CompareResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<CompareRequest | undefined>(undefined);
  const [progressMessage, setProgressMessage] = useState<string>('');
  const [progressStep, setProgressStep] = useState<number>(0);
  const [progressTotal] = useState<number>(7);

  const handleCompare = async (formData: CompareRequest) => {
    setLoading(true);
    setError(null);
    setResult(null);
    setProgressStep(0);
    
    // Progress steps: 1-Initializing, 2-Cloning, 3-Extracting v1, 4-Extracting v2, 
    // 5-Building dependencies, 6-Rendering templates, 7-Comparing
    
    try {
      setProgressMessage('Initializing comparison...');
      setProgressStep(1);
      await new Promise(resolve => setTimeout(resolve, 100));
      
      setProgressMessage('Cloning repository...');
      setProgressStep(2);
      
      const progressMessages = [
        'Cloning repository...',
        'Extracting version 1...',
        'Extracting version 2...',
        'Building chart dependencies...',
        'Rendering Helm templates...',
        'Comparing YAML differences...'
      ];

      let progressInterval: NodeJS.Timeout | null = null;
      let messageInterval: NodeJS.Timeout | null = null;

      try {
        progressInterval = setInterval(() => {
          setProgressStep((prev) => {
            if (prev < 6) return prev + 1;
            return prev;
          });
        }, 2000);

        let messageIndex = 0;
        messageInterval = setInterval(() => {
          if (messageIndex < progressMessages.length - 1) {
            messageIndex++;
            setProgressMessage(progressMessages[messageIndex]);
          }
        }, 2000);

        const response = await fetch('/api/compare', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(formData),
        });

        if (progressInterval) clearInterval(progressInterval);
        if (messageInterval) clearInterval(messageInterval);
        progressInterval = null;
        messageInterval = null;

        setProgressMessage('Processing results...');
        setProgressStep(6);

        let data: CompareResponse;
        try {
          data = await response.json();
        } catch (jsonError) {
          throw new Error(`Failed to parse response: ${response.statusText || 'Unknown error'}`);
        }

        if (!response.ok || !data.success) {
          const errorMsg = data?.error || 'Failed to compare versions';
          throw new Error(errorMsg);
        }

        setProgressMessage('Comparison complete!');
        setProgressStep(7);
        setResult(data);
        
        setTimeout(() => {
          setProgressMessage('');
          setProgressStep(0);
        }, 1500);
      } catch (err: any) {
        if (progressInterval) clearInterval(progressInterval);
        if (messageInterval) clearInterval(messageInterval);
        throw err;
      }
    } catch (err: any) {
      let errorMessage = 'An error occurred';
      
      if (err.name === 'AbortError') {
        errorMessage = 'Request was cancelled';
      } else if (err.message) {
        errorMessage = err.message;
      } else if (err instanceof TypeError && err.message.includes('fetch')) {
        errorMessage = 'Network error: Could not connect to the server. Please check your connection and try again.';
      } else if (err instanceof Error) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
      setProgressMessage('');
      setProgressStep(0);
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
        <CompareForm 
          key={formData ? JSON.stringify(formData) : 'empty'}
          onSubmit={handleCompare} 
          loading={loading} 
          initialData={formData} 
        />

        {loading && progressMessage && (
          <ProgressIndicator 
            message={progressMessage}
            step={progressStep}
            totalSteps={progressTotal}
          />
        )}

        {error && (
          <div style={{
            marginTop: '1.5rem',
            padding: '1.5rem',
            background: '#fee',
            border: '1px solid #fcc',
            borderRadius: '8px',
            color: '#c33'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              marginBottom: '0.5rem'
            }}>
              <span style={{ fontSize: '1.25rem' }}>⚠️</span>
              <strong style={{ fontSize: '1.1rem' }}>Error</strong>
            </div>
            <div style={{
              paddingLeft: '1.75rem',
              fontSize: '0.95rem',
              lineHeight: '1.6',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word'
            }}>
              {error}
            </div>
          </div>
        )}

        {result && (
          <div style={{ marginTop: '2rem' }}>
            <DiffDisplay 
              result={result} 
              ignoreLabels={formData?.ignoreLabels}
            />
          </div>
        )}
      </div>
    </main>
  );
}
