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
      // Clone the repository (full clone to get all tags and branches)
      // Use --no-single-branch to fetch all branches
      await execAsync(`git clone --no-single-branch ${repo} ${targetPath}`, {
        timeout: 120000
      });
      // Explicitly fetch all tags after cloning
      await execAsync(`git -C ${targetPath} fetch --tags`, {
        timeout: 30000
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
      // Ensure we have all refs, including tags and branches
      // Fetch all tags in case they weren't included in the clone
      await execAsync(`git -C ${repoPath} fetch --all --tags --prune`, {
        timeout: 60000
      });
      
      // Escape the version to handle special characters and shell injection
      const escapedVersion = version.replace(/[;&|`$(){}]/g, '\\$&');
      
      // Try to checkout - Git will automatically resolve tags, branches, or commits
      try {
        await execAsync(`git -C ${repoPath} checkout ${escapedVersion} 2>&1`, {
          timeout: 15000
        });
      } catch (checkoutError: any) {
        // The version might not exist - provide a helpful error message
        // First, let's check what refs are available
        let availableRefs = '';
        try {
          const { stdout: tagsStdout } = await execAsync(`git -C ${repoPath} tag -l`, { timeout: 5000 });
          const { stdout: branchesStdout } = await execAsync(`git -C ${repoPath} branch -r --format='%(refname:short)'`, { timeout: 5000 });
          const tags = tagsStdout.trim().split('\n').filter(t => t).slice(0, 10).join(', ');
          const branches = branchesStdout.trim().split('\n').filter(b => b).slice(0, 10).join(', ');
          availableRefs = `\nAvailable tags (sample): ${tags || 'none'}\nAvailable branches (sample): ${branches || 'none'}`;
        } catch {
          // Ignore errors when checking refs
        }
        
        throw new Error(
          `Version/tag/branch "${version}" not found in the repository.` +
          `${availableRefs}\nPlease verify that the version exists in the repository.`
        );
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
    } catch (error: any) {
      throw new Error(`Failed to extract version ${version}: ${error.message || error}`);
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

