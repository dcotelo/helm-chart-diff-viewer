import { HelmService } from '../helm-service';

// Mock child_process and fs
const mockExec = jest.fn();
jest.mock('child_process', () => ({
  exec: (...args: any[]) => mockExec(...args),
}));

const mockMkdir = jest.fn();
const mockAccess = jest.fn();
const mockReaddir = jest.fn();
const mockWriteFile = jest.fn();
const mockCopyFile = jest.fn();
const mockRm = jest.fn();
const mockUnlink = jest.fn();

jest.mock('fs/promises', () => ({
  mkdir: (...args: any[]) => mockMkdir(...args),
  access: (...args: any[]) => mockAccess(...args),
  readdir: (...args: any[]) => mockReaddir(...args),
  writeFile: (...args: any[]) => mockWriteFile(...args),
  copyFile: (...args: any[]) => mockCopyFile(...args),
  rm: (...args: any[]) => mockRm(...args),
  unlink: (...args: any[]) => mockUnlink(...args),
}));

describe('HelmService', () => {
  let helmService: HelmService;

  beforeEach(() => {
    helmService = new HelmService();
    jest.clearAllMocks();
    // Reset all mocks to default successful behavior
    mockMkdir.mockResolvedValue(undefined);
    mockAccess.mockResolvedValue(undefined);
    mockReaddir.mockResolvedValue([{ name: 'Chart.yaml', isDirectory: () => false }] as any);
    mockWriteFile.mockResolvedValue(undefined);
    mockCopyFile.mockResolvedValue(undefined);
    mockRm.mockResolvedValue(undefined);
    mockUnlink.mockResolvedValue(undefined);
    mockExec.mockImplementation((command: string, options: any, callback?: any) => {
      const cb = callback || options;
      cb(null, { stdout: '', stderr: '' });
      return {} as any;
    });
  });

  describe('compareVersions', () => {
    const mockOptions = {
      repository: 'https://github.com/test/repo.git',
      chartPath: 'charts/app',
      version1: 'v1.0.0',
      version2: 'v1.1.0',
    };

    it('should successfully compare two versions', async () => {
      // Mock file system operations - access is called for each version (2 times)
      mockMkdir.mockResolvedValue(undefined);
      mockAccess
        .mockResolvedValueOnce(undefined) // version1 access check
        .mockResolvedValueOnce(undefined); // version2 access check
      // Mock readdir for copyDirectory - called for each version's chart directory
      mockReaddir
        .mockResolvedValueOnce([{ name: 'Chart.yaml', isDirectory: () => false }] as any) // version1
        .mockResolvedValueOnce([{ name: 'Chart.yaml', isDirectory: () => false }] as any) // version2
        .mockResolvedValue([{ name: 'Chart.yaml', isDirectory: () => false }] as any); // fallback
      mockWriteFile.mockResolvedValue(undefined);
      mockCopyFile.mockResolvedValue(undefined);
      mockRm.mockResolvedValue(undefined);

      // Mock git commands - exec is used with promisify, so it needs to call the callback
      mockExec.mockImplementation((command: string, options: any, callback?: any) => {
        const cb = callback || options;
        if (command.includes('git clone')) {
          cb(null, { stdout: '', stderr: '' });
        } else if (command.includes('git -C') && command.includes('fetch')) {
          cb(null, { stdout: '', stderr: '' });
        } else if (command.includes('git -C') && command.includes('checkout')) {
          cb(null, { stdout: '', stderr: '' });
        } else if (command.includes('helm template')) {
          cb(null, { stdout: 'apiVersion: v1\nkind: Service', stderr: '' });
        } else if (command.includes('dyff')) {
          cb(null, { stdout: '--- version1\n+++ version2\n', stderr: '' });
        } else {
          cb(null, { stdout: '', stderr: '' });
        }
        return {} as any;
      });

      const result = await helmService.compareVersions(mockOptions);

      expect(result).toHaveProperty('diff');
      expect(result).toHaveProperty('hasDiff');
      expect(result.hasDiff).toBe(true);
    });

    it('should handle missing chart path', async () => {
      mockMkdir.mockResolvedValue(undefined);
      mockAccess.mockRejectedValue(new Error('File not found'));

      mockExec.mockImplementation((command: string, options: any, callback?: any) => {
        const cb = callback || options;
        if (command.includes('git clone')) {
          cb(null, { stdout: '', stderr: '' });
        } else if (command.includes('git -C') && command.includes('fetch')) {
          cb(null, { stdout: '', stderr: '' });
        } else if (command.includes('git -C') && command.includes('checkout')) {
          cb(null, { stdout: '', stderr: '' });
        } else {
          cb(null, { stdout: '', stderr: '' });
        }
        return {} as any;
      });

      await expect(helmService.compareVersions(mockOptions)).rejects.toThrow(
        'Chart path not found'
      );
    });

    it('should handle git clone failure', async () => {
      mockMkdir.mockResolvedValue(undefined);

      mockExec.mockImplementation((command: string, options: any, callback?: any) => {
        const cb = callback || options;
        if (command.includes('git clone')) {
          cb(new Error('Clone failed'), { stdout: '', stderr: 'Clone failed' });
        } else {
          cb(null, { stdout: '', stderr: '' });
        }
        return {} as any;
      });

      await expect(helmService.compareVersions(mockOptions)).rejects.toThrow(
        'Failed to clone repository'
      );
    });

    it('should use valuesContent when provided', async () => {
      mockMkdir.mockResolvedValue(undefined);
      mockAccess
        .mockResolvedValueOnce(undefined) // version1 access check
        .mockResolvedValueOnce(undefined); // version2 access check
      // Mock readdir for copyDirectory - called for each version's chart directory
      mockReaddir
        .mockResolvedValueOnce([{ name: 'Chart.yaml', isDirectory: () => false }] as any) // version1
        .mockResolvedValueOnce([{ name: 'Chart.yaml', isDirectory: () => false }] as any) // version2
        .mockResolvedValue([{ name: 'Chart.yaml', isDirectory: () => false }] as any); // fallback
      mockWriteFile.mockResolvedValue(undefined);
      mockCopyFile.mockResolvedValue(undefined);
      mockRm.mockResolvedValue(undefined);

      mockExec.mockImplementation((command: string, options: any, callback?: any) => {
        const cb = callback || options;
        if (command.includes('git clone')) {
          cb(null, { stdout: '', stderr: '' });
        } else if (command.includes('git -C') && command.includes('fetch')) {
          cb(null, { stdout: '', stderr: '' });
        } else if (command.includes('git -C') && command.includes('checkout')) {
          cb(null, { stdout: '', stderr: '' });
        } else if (command.includes('helm template')) {
          expect(command).toContain('-f');
          cb(null, { stdout: 'rendered template', stderr: '' });
        } else if (command.includes('dyff')) {
          cb(null, { stdout: 'diff output', stderr: '' });
        } else {
          cb(null, { stdout: '', stderr: '' });
        }
        return {} as any;
      });

      const options = {
        ...mockOptions,
        valuesContent: 'replicaCount: 3',
      };

      await helmService.compareVersions(options);

      expect(mockWriteFile).toHaveBeenCalledWith(
        expect.stringContaining('values.yaml'),
        'replicaCount: 3',
        'utf-8'
      );
    });
  });
});

