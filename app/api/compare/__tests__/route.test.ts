import { POST } from '../route';
import { NextRequest } from 'next/server';
import { HelmService } from '@/services/helm-service';

// Mock the HelmService
jest.mock('@/services/helm-service', () => ({
  HelmService: jest.fn(),
}));

// Mock NextRequest for Jest environment
jest.mock('next/server', () => ({
  NextRequest: class MockNextRequest {
    constructor(public url: string, public init?: any) {}
    async json() {
      return JSON.parse(this.init?.body || '{}');
    }
  },
  NextResponse: {
    json: (data: any, init?: any) => ({
      json: async () => data,
      status: init?.status || 200,
    }),
  },
}));

describe('/api/compare', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return 400 for missing required fields', async () => {
    const request = new NextRequest('http://localhost:3000/api/compare', {
      method: 'POST',
      body: JSON.stringify({
        repository: 'https://github.com/test/repo.git',
        // Missing chartPath, version1, version2
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toContain('Missing required fields');
  });

  it('should return 400 for invalid repository URL', async () => {
    const request = new NextRequest('http://localhost:3000/api/compare', {
      method: 'POST',
      body: JSON.stringify({
        repository: 'invalid-url',
        chartPath: 'charts/app',
        version1: 'v1.0.0',
        version2: 'v1.1.0',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toContain('Invalid repository URL format');
  });

  it('should successfully compare versions', async () => {
    const mockDiff = '--- version1\n+++ version2\n@@ -1,3 +1,3 @@\n-replicaCount: 1\n+replicaCount: 3';
    
    (HelmService as jest.MockedClass<typeof HelmService>).mockImplementation(() => ({
      compareVersions: jest.fn().mockResolvedValue({
        diff: mockDiff,
        hasDiff: true,
      }),
    } as any));

    const request = new NextRequest('http://localhost:3000/api/compare', {
      method: 'POST',
      body: JSON.stringify({
        repository: 'https://github.com/test/repo.git',
        chartPath: 'charts/app',
        version1: 'v1.0.0',
        version2: 'v1.1.0',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.diff).toBe(mockDiff);
    expect(data.version1).toBe('v1.0.0');
    expect(data.version2).toBe('v1.1.0');
  });

  it('should handle HelmService errors', async () => {
    (HelmService as jest.MockedClass<typeof HelmService>).mockImplementation(() => ({
      compareVersions: jest.fn().mockRejectedValue(new Error('Helm command failed')),
    } as any));

    const request = new NextRequest('http://localhost:3000/api/compare', {
      method: 'POST',
      body: JSON.stringify({
        repository: 'https://github.com/test/repo.git',
        chartPath: 'charts/app',
        version1: 'v1.0.0',
        version2: 'v1.1.0',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.error).toBeDefined();
  });

  it('should pass valuesFile and valuesContent to HelmService', async () => {
    const mockCompareVersions = jest.fn().mockResolvedValue({
      diff: '',
      hasDiff: false,
    });

    (HelmService as jest.MockedClass<typeof HelmService>).mockImplementation(() => ({
      compareVersions: mockCompareVersions,
    } as any));

    const request = new NextRequest('http://localhost:3000/api/compare', {
      method: 'POST',
      body: JSON.stringify({
        repository: 'https://github.com/test/repo.git',
        chartPath: 'charts/app',
        version1: 'v1.0.0',
        version2: 'v1.1.0',
        valuesFile: 'values/prod.yaml',
        valuesContent: 'replicaCount: 3',
      }),
    });

    await POST(request);

    expect(mockCompareVersions).toHaveBeenCalledWith({
      repository: 'https://github.com/test/repo.git',
      chartPath: 'charts/app',
      version1: 'v1.0.0',
      version2: 'v1.1.0',
      valuesFile: 'values/prod.yaml',
      valuesContent: 'replicaCount: 3',
    });
  });
});

