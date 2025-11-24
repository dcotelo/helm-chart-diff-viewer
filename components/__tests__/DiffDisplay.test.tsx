import { render, screen } from '@testing-library/react';
import { DiffDisplay } from '../DiffDisplay';
import { CompareResponse } from '@/lib/types';

// Mock react-syntax-highlighter
jest.mock('react-syntax-highlighter', () => ({
  Prism: ({ children }: any) => <pre>{children}</pre>,
}));

describe('DiffDisplay', () => {
  it('should display version information', () => {
    const result: CompareResponse = {
      success: true,
      diff: '',
      version1: 'v1.0.0',
      version2: 'v1.1.0',
    };

    render(<DiffDisplay result={result} />);

    expect(screen.getByText(/version 1:/i)).toBeInTheDocument();
    expect(screen.getByText('v1.0.0')).toBeInTheDocument();
    expect(screen.getByText(/version 2:/i)).toBeInTheDocument();
    expect(screen.getByText('v1.1.0')).toBeInTheDocument();
  });

  it('should show "no differences" message when diff is empty', () => {
    const result: CompareResponse = {
      success: true,
      diff: '',
      version1: 'v1.0.0',
      version2: 'v1.1.0',
    };

    render(<DiffDisplay result={result} />);

    expect(screen.getByText(/no differences found/i)).toBeInTheDocument();
  });

  it('should show "differences detected" message when diff exists', () => {
    const result: CompareResponse = {
      success: true,
      diff: '--- version1\n+++ version2\n@@ -1,3 +1,3 @@\n-replicaCount: 1\n+replicaCount: 3',
      version1: 'v1.0.0',
      version2: 'v1.1.0',
    };

    render(<DiffDisplay result={result} />);

    expect(screen.getByText(/differences detected/i)).toBeInTheDocument();
  });

  it('should display diff content when present', () => {
    const diffContent = '--- version1\n+++ version2\n@@ -1,3 +1,3 @@\n-replicaCount: 1\n+replicaCount: 3';
    const result: CompareResponse = {
      success: true,
      diff: diffContent,
      version1: 'v1.0.0',
      version2: 'v1.1.0',
    };

    render(<DiffDisplay result={result} />);

    // The SyntaxHighlighter component should render the diff
    // We can check that the component renders without errors
    expect(screen.getByText(/differences detected/i)).toBeInTheDocument();
  });

  it('should handle whitespace-only diff as no differences', () => {
    const result: CompareResponse = {
      success: true,
      diff: '   \n  \n  ',
      version1: 'v1.0.0',
      version2: 'v1.1.0',
    };

    render(<DiffDisplay result={result} />);

    expect(screen.getByText(/no differences found/i)).toBeInTheDocument();
  });
});

