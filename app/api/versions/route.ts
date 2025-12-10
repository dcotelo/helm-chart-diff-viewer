import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import { tmpdir } from 'os';

const execAsync = promisify(exec);

export const runtime = 'nodejs';
export const maxDuration = 60; // 1 minute max

interface VersionsResponse {
  success: boolean;
  tags?: string[];
  branches?: string[];
  error?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { repository } = body;
    
    if (!repository) {
      return NextResponse.json<VersionsResponse>({
        success: false,
        error: 'Repository URL is required'
      }, { status: 400 });
    }

    // Validate repository URL format
    if (!repository.match(/^(https?:\/\/|git@)/)) {
      return NextResponse.json<VersionsResponse>({
        success: false,
        error: 'Invalid repository URL format'
      }, { status: 400 });
    }

    // Create temporary directory for cloning
    const workDir = path.join(tmpdir(), 'helm-diff-viewer');
    const requestId = `versions-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const repoPath = path.join(workDir, requestId);
    
    try {
      // Set environment variables to prevent Git from prompting for credentials
      const env = {
        ...process.env,
        GIT_TERMINAL_PROMPT: '0',
        GIT_ASKPASS: '',
        GIT_CREDENTIAL_HELPER: ''
      };

      // Escape repository URL for shell safety
      const escapedRepo = repository.replace(/[;&|`$(){}]/g, '\\$&');

      // Clone repository (shallow clone for speed)
      await fs.mkdir(repoPath, { recursive: true });
      await execAsync(`git clone --no-single-branch --depth=50 "${escapedRepo}" "${repoPath}"`, {
        timeout: 60000,
        env
      });

      // Fetch all tags
      await execAsync(`git -C "${repoPath}" fetch --tags --depth=100`, {
        timeout: 30000,
        env
      });

      // Get all tags
      let tags: string[] = [];
      try {
        const { stdout: tagsOutput } = await execAsync(`git -C "${repoPath}" tag --sort=-creatordate`, {
          timeout: 10000,
          env
        });
        tags = tagsOutput.trim().split('\n').filter(tag => tag.length > 0).slice(0, 100); // Limit to 100 most recent
      } catch (e) {
        // No tags found, that's okay
        tags = [];
      }

      // Get all branches
      let branches: string[] = [];
      try {
        const { stdout: branchesOutput } = await execAsync(`git -C "${repoPath}" branch -r --sort=-committerdate`, {
          timeout: 10000,
          env
        });
        branches = branchesOutput
          .trim()
          .split('\n')
          .filter(branch => branch.length > 0)
          .map(branch => branch.trim().replace(/^origin\//, ''))
          .filter(branch => !branch.includes('HEAD'))
          .slice(0, 50); // Limit to 50 most recent
      } catch (e) {
        // No branches found, that's okay
        branches = [];
      }

      // Cleanup
      await fs.rm(repoPath, { recursive: true, force: true }).catch(() => {});

      return NextResponse.json<VersionsResponse>({
        success: true,
        tags: tags.slice(0, 50), // Return top 50 tags
        branches: branches.slice(0, 20) // Return top 20 branches
      });

    } catch (error: any) {
      // Cleanup on error
      await fs.rm(repoPath, { recursive: true, force: true }).catch(() => {});
      throw error;
    }

  } catch (error: any) {
    console.error('Versions fetch error:', error);
    return NextResponse.json<VersionsResponse>({
      success: false,
      error: error.message || 'Failed to fetch versions from repository'
    }, { status: 500 });
  }
}

