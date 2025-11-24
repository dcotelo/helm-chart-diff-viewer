'use client';

import { CompareResponse } from '@/lib/types';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/cjs/styles/prism';

interface DiffDisplayProps {
  result: CompareResponse;
}

export function DiffDisplay({ result }: DiffDisplayProps) {
  const hasDiff = result.diff && result.diff.trim().length > 0;

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
        <h2 style={{
          fontSize: '1.5rem',
          marginBottom: '0.5rem',
          color: '#333'
        }}>
          Comparison Results
        </h2>
        <div style={{
          display: 'flex',
          gap: '1rem',
          fontSize: '0.9rem',
          color: '#666'
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
        </div>
      </div>

      <div style={{ background: '#1e1e1e' }}>
        {hasDiff ? (
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
            <SyntaxHighlighter
              language="diff"
              style={oneDark}
              customStyle={{
                margin: 0,
                padding: '1rem',
                fontSize: '0.875rem',
                lineHeight: '1.6'
              }}
            >
              {result.diff || ''}
            </SyntaxHighlighter>
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

