import { NextRequest, NextResponse } from 'next/server';
import { HelmService } from '@/services/helm-service';
import { CompareRequest, CompareResponse } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 120; // 2 minutes max

export async function POST(request: NextRequest) {
  try {
    const body: CompareRequest = await request.json();
    
    // Validate inputs
    if (!body.repository || !body.chartPath || !body.version1 || !body.version2) {
      return NextResponse.json<CompareResponse>({
        success: false,
        error: 'Missing required fields: repository, chartPath, version1, version2\n\n' +
               'For monorepo structures, use chart paths like:\n' +
               '  - charts/<chart-name> (e.g., charts/datadog)\n' +
               '  - chart/<chart-name>\n' +
               '  - <chart-name> (if chart is at repository root)'
      }, { status: 400 });
    }

    // Validate repository URL format
    if (!body.repository.match(/^(https?:\/\/|git@)/)) {
      return NextResponse.json<CompareResponse>({
        success: false,
        error: 'Invalid repository URL format. Please use:\n' +
               '  - HTTPS: https://github.com/user/repo.git\n' +
               '  - SSH: git@github.com:user/repo.git'
      }, { status: 400 });
    }

    // Validate chart path format
    if (body.chartPath.trim() === '') {
      return NextResponse.json<CompareResponse>({
        success: false,
        error: 'Chart path cannot be empty. For monorepo structures, specify the path like:\n' +
               '  - charts/datadog\n' +
               '  - charts/datadog-operator\n' +
               '  - chart/my-chart'
      }, { status: 400 });
    }

    const helmService = new HelmService();
    
    const result = await helmService.compareVersions({
      repository: body.repository,
      chartPath: body.chartPath,
      version1: body.version1,
      version2: body.version2,
      valuesFile: body.valuesFile,
      valuesContent: body.valuesContent
    });

    return NextResponse.json<CompareResponse>({
      success: true,
      diff: result.diff,
      version1: body.version1,
      version2: body.version2
    });

  } catch (error: any) {
    console.error('Comparison error:', error);
    return NextResponse.json<CompareResponse>({
      success: false,
      error: error.message || 'Failed to compare Helm chart versions'
    }, { status: 500 });
  }
}

