import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CompareForm } from '../CompareForm';

describe('CompareForm', () => {
  const mockOnSubmit = jest.fn();
  const user = userEvent.setup();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render all form fields', () => {
    render(<CompareForm onSubmit={mockOnSubmit} loading={false} />);

    expect(screen.getByPlaceholderText(/github.com\/user\/repo/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText('charts/app')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('v1.0.0')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('v1.1.0')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('values/prod.yaml')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/replicaCount: 3/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /compare versions/i })).toBeInTheDocument();
  });

  it('should have default value for chart path', () => {
    render(<CompareForm onSubmit={mockOnSubmit} loading={false} />);

    const chartPathInput = screen.getByPlaceholderText('charts/app') as HTMLInputElement;
    expect(chartPathInput.value).toBe('charts/app');
  });

  it('should call onSubmit with form data when submitted', async () => {
    render(<CompareForm onSubmit={mockOnSubmit} loading={false} />);

    await user.type(screen.getByPlaceholderText(/github.com\/user\/repo/i), 'https://github.com/test/repo.git');
    const chartPathInput = screen.getByPlaceholderText('charts/app');
    await user.clear(chartPathInput);
    await user.type(chartPathInput, 'charts/myapp');
    await user.type(screen.getByPlaceholderText('v1.0.0'), 'v1.0.0');
    await user.type(screen.getByPlaceholderText('v1.1.0'), 'v1.1.0');

    await user.click(screen.getByRole('button', { name: /compare versions/i }));

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith({
        repository: 'https://github.com/test/repo.git',
        chartPath: 'charts/myapp',
        version1: 'v1.0.0',
        version2: 'v1.1.0',
        valuesFile: '',
        valuesContent: '',
      });
    });
  });

  it('should disable submit button when loading', () => {
    render(<CompareForm onSubmit={mockOnSubmit} loading={true} />);

    const submitButton = screen.getByRole('button', { name: /comparing/i });
    expect(submitButton).toBeDisabled();
  });

  it('should show loading text on button when loading', () => {
    render(<CompareForm onSubmit={mockOnSubmit} loading={true} />);

    expect(screen.getByRole('button', { name: /comparing/i })).toBeInTheDocument();
  });

  it('should allow optional values file input', async () => {
    render(<CompareForm onSubmit={mockOnSubmit} loading={false} />);

    await user.type(screen.getByPlaceholderText(/github.com\/user\/repo/i), 'https://github.com/test/repo.git');
    await user.type(screen.getByPlaceholderText('v1.0.0'), 'v1.0.0');
    await user.type(screen.getByPlaceholderText('v1.1.0'), 'v1.1.0');
    await user.type(screen.getByPlaceholderText('values/prod.yaml'), 'values/prod.yaml');

    await user.click(screen.getByRole('button', { name: /compare versions/i }));

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          valuesFile: 'values/prod.yaml',
        })
      );
    });
  });

  it('should allow optional values content input', async () => {
    render(<CompareForm onSubmit={mockOnSubmit} loading={false} />);

    await user.type(screen.getByPlaceholderText(/github.com\/user\/repo/i), 'https://github.com/test/repo.git');
    await user.type(screen.getByPlaceholderText('v1.0.0'), 'v1.0.0');
    await user.type(screen.getByPlaceholderText('v1.1.0'), 'v1.1.0');
    const textarea = screen.getByPlaceholderText(/replicaCount: 3/i);
    await user.clear(textarea);
    await user.type(textarea, 'replicaCount: 3\nimage:\n  tag: latest');

    await user.click(screen.getByRole('button', { name: /compare versions/i }));

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          valuesContent: 'replicaCount: 3\nimage:\n  tag: latest',
        })
      );
    });
  });
});

