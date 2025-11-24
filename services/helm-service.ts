import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import { tmpdir } from 'os';

const execAsync = promisify(exec);

export interface HelmCompareOptions {
  repository: string;
  chartPath: string;
  version1: string;
  version2: string;
  valuesFile?: string;
  valuesContent?: string;
}

export class HelmService {
  private workDir: string;

  constructor() {
    this.workDir = path.join(tmpdir(), 'helm-diff-viewer');
  }

  async compareVersions(options: HelmCompareOptions): Promise<{ diff: string; hasDiff: boolean }> {
    const { repository, chartPath, version1, version2, valuesFile, valuesContent } = options;
    
    // Create unique work directory for this request
    const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const workPath = path.join(this.workDir, requestId);
    
    try {
      // Ensure work directory exists
      await fs.mkdir(workPath, { recursive: true });
      
      // Clone repository
      const repoPath = path.join(workPath, 'repo');
      await this.cloneRepository(repository, repoPath);
      
      // Extract versions
      const version1Path = path.join(workPath, 'version1');
      const version2Path = path.join(workPath, 'version2');
      
      await this.extractVersion(repoPath, chartPath, version1, version1Path);
      await this.extractVersion(repoPath, chartPath, version2, version2Path);
      
      // Create values file if provided
      let valuesFilePath: string | undefined;
      if (valuesContent) {
        valuesFilePath = path.join(workPath, 'values.yaml');
        await fs.writeFile(valuesFilePath, valuesContent, 'utf-8');
      } else if (valuesFile) {
        valuesFilePath = path.join(repoPath, valuesFile);
      }
      
      // Render Helm templates
      const rendered1 = await this.renderHelmTemplate(version1Path, valuesFilePath);
      const rendered2 = await this.renderHelmTemplate(version2Path, valuesFilePath);
      
      // Compare using dyff or fallback to diff
      const diff = await this.compareYaml(rendered1, rendered2);
      
      // Cleanup
      await this.cleanup(workPath);
      
      return {
        diff,
        hasDiff: diff.trim().length > 0
      };
    } catch (error) {
      // Cleanup on error
      await this.cleanup(workPath).catch(() => {});
      throw error;
    }
  }

  private async cloneRepository(repo: string, targetPath: string): Promise<void> {
    try {
      await fs.mkdir(targetPath, { recursive: true });
      await execAsync(`git clone --depth 1 ${repo} ${targetPath}`, {
        timeout: 60000
      });
    } catch (error) {
      throw new Error(`Failed to clone repository: ${error}`);
    }
  }

  private async extractVersion(
    repoPath: string,
    chartPath: string,
    version: string,
    targetPath: string
  ): Promise<void> {
    try {
      // Checkout specific version
      await execAsync(`git -C ${repoPath} fetch --tags --depth 1`, {
        timeout: 30000
      });
      
      // Try to checkout as tag first, then as branch/commit
      try {
        await execAsync(`git -C ${repoPath} checkout ${version}`, {
          timeout: 10000
        });
      } catch {
        // If tag doesn't work, try as commit SHA
        await execAsync(`git -C ${repoPath} checkout ${version}`, {
          timeout: 10000
        });
      }
      
      // Copy chart directory
      const sourceChartPath = path.join(repoPath, chartPath);
      await fs.mkdir(targetPath, { recursive: true });
      
      // Check if chart path exists
      try {
        await fs.access(sourceChartPath);
        await this.copyDirectory(sourceChartPath, targetPath);
      } catch {
        throw new Error(`Chart path not found: ${chartPath} at version ${version}`);
      }
    } catch (error) {
      throw new Error(`Failed to extract version ${version}: ${error}`);
    }
  }

  private async copyDirectory(src: string, dest: string): Promise<void> {
    const entries = await fs.readdir(src, { withFileTypes: true });
    
    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);
      
      if (entry.isDirectory()) {
        await fs.mkdir(destPath, { recursive: true });
        await this.copyDirectory(srcPath, destPath);
      } else {
        await fs.copyFile(srcPath, destPath);
      }
    }
  }

  private async renderHelmTemplate(
    chartPath: string,
    valuesFile?: string
  ): Promise<string> {
    try {
      const valuesFlag = valuesFile ? `-f ${valuesFile}` : '';
      const { stdout, stderr } = await execAsync(
        `helm template app ${chartPath} ${valuesFlag}`,
        { timeout: 30000 }
      );
      
      if (stderr && !stderr.includes('Warning')) {
        throw new Error(`Helm template error: ${stderr}`);
      }
      
      return stdout;
    } catch (error: any) {
      throw new Error(`Failed to render Helm template: ${error.message}`);
    }
  }

  private async compareYaml(yaml1: string, yaml2: string): Promise<string> {
    // Try to use dyff if available, otherwise fallback to diff
    try {
      // Write to temp files for dyff
      const tmp1 = path.join(this.workDir, `tmp1-${Date.now()}.yaml`);
      const tmp2 = path.join(this.workDir, `tmp2-${Date.now()}.yaml`);
      
      await fs.writeFile(tmp1, yaml1, 'utf-8');
      await fs.writeFile(tmp2, yaml2, 'utf-8');
      
      try {
        const { stdout } = await execAsync(
          `dyff between "${tmp1}" "${tmp2}" --omit-header`,
          { timeout: 10000 }
        );
        
        // Cleanup temp files
        await fs.unlink(tmp1).catch(() => {});
        await fs.unlink(tmp2).catch(() => {});
        
        return stdout;
      } catch {
        // Cleanup temp files
        await fs.unlink(tmp1).catch(() => {});
        await fs.unlink(tmp2).catch(() => {});
        throw new Error('dyff failed');
      }
    } catch {
      // Fallback to simple diff or custom comparison
      return this.simpleYamlDiff(yaml1, yaml2);
    }
  }

  private simpleYamlDiff(yaml1: string, yaml2: string): string {
    // Simple text-based diff as fallback
    const lines1 = yaml1.split('\n');
    const lines2 = yaml2.split('\n');
    
    const diff: string[] = [];
    const maxLen = Math.max(lines1.length, lines2.length);
    
    for (let i = 0; i < maxLen; i++) {
      const line1 = lines1[i] || '';
      const line2 = lines2[i] || '';
      
      if (line1 !== line2) {
        if (line1) diff.push(`- ${line1}`);
        if (line2) diff.push(`+ ${line2}`);
      }
    }
    
    return diff.join('\n');
  }

  private async cleanup(workPath: string): Promise<void> {
    try {
      await fs.rm(workPath, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
      console.error('Cleanup error:', error);
    }
  }
}

