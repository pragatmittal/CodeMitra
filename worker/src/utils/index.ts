import fs from 'fs-extra';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import tmp from 'tmp';
import winston from 'winston';
import { SecurityScanResult, SecurityIssue, WorkerConfig } from '../types';

// Logger configuration
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'codemitra-worker' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

// Add file transport if specified
if (process.env.LOG_FILE) {
  logger.add(new winston.transports.File({ filename: process.env.LOG_FILE }));
}

// Configuration
export const getWorkerConfig = (): WorkerConfig => {
  return {
    redis: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_DB || '0')
    },
    docker: {
      socketPath: process.env.DOCKER_SOCKET_PATH || '/var/run/docker.sock',
      host: process.env.DOCKER_HOST,
      port: process.env.DOCKER_PORT ? parseInt(process.env.DOCKER_PORT) : undefined,
      timeout: parseInt(process.env.DOCKER_TIMEOUT || '60000'),
      maxConcurrentExecutions: parseInt(process.env.MAX_CONCURRENT_EXECUTIONS || '10'),
      imageRetentionTime: parseInt(process.env.IMAGE_RETENTION_TIME || '86400000') // 24 hours
    },
    execution: {
      defaultTimeout: parseInt(process.env.DEFAULT_TIMEOUT || '30000'),
      maxTimeout: parseInt(process.env.MAX_TIMEOUT || '300000'),
      defaultMemoryLimit: process.env.DEFAULT_MEMORY_LIMIT || '256m',
      maxMemoryLimit: process.env.MAX_MEMORY_LIMIT || '1g',
      tempDir: process.env.TEMP_DIR || '/tmp/codemitra',
      cleanupInterval: parseInt(process.env.CLEANUP_INTERVAL || '300000') // 5 minutes
    },
    security: {
      enableSandbox: process.env.ENABLE_SANDBOX === 'true',
      enableSecurityScan: process.env.ENABLE_SECURITY_SCAN === 'true',
      allowedHosts: process.env.ALLOWED_HOSTS?.split(',') || [],
      bannedKeywords: process.env.BANNED_KEYWORDS?.split(',') || [
        'eval', 'exec', 'system', 'shell_exec', 'passthru', 'proc_open',
        'popen', 'fork', 'spawn', 'child_process', 'require', 'import',
        'subprocess', 'os.system', 'os.exec', 'Runtime.getRuntime',
        'ProcessBuilder', 'javax.script', 'java.lang.reflect',
        'java.lang.Runtime', 'java.lang.Process'
      ]
    },
    logging: {
      level: process.env.LOG_LEVEL || 'info',
      format: process.env.LOG_FORMAT || 'json',
      file: process.env.LOG_FILE
    }
  };
};

// File system utilities
export const createTempDirectory = async (): Promise<string> => {
  const config = getWorkerConfig();
  
  // Use /tmp/codemitra-shared for Docker-in-Docker compatibility
  const baseDir = '/tmp/codemitra-shared';
  const tempDir = path.join(baseDir, `codemitra-${uuidv4()}`);
  
  await fs.ensureDir(tempDir);
  return tempDir;
};

export const writeCodeToFile = async (code: string, filePath: string): Promise<void> => {
  await fs.writeFile(filePath, code, 'utf8');
};

export const readFileContent = async (filePath: string): Promise<string> => {
  return await fs.readFile(filePath, 'utf8');
};

export const fileExists = async (filePath: string): Promise<boolean> => {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
};

export const cleanupDirectory = async (dirPath: string): Promise<void> => {
  try {
    await fs.remove(dirPath);
    logger.debug(`Cleaned up directory: ${dirPath}`);
  } catch (error) {
    logger.error(`Failed to cleanup directory ${dirPath}:`, error);
  }
};

export const getFileSize = async (filePath: string): Promise<number> => {
  const stats = await fs.stat(filePath);
  return stats.size;
};

export const createInputFile = async (input: string, dirPath: string): Promise<string> => {
  const inputFile = path.join(dirPath, 'input.txt');
  await fs.writeFile(inputFile, input, 'utf8');
  return inputFile;
};

// Security utilities
export const scanCodeForSecurity = (code: string, language: string): SecurityScanResult => {
  const issues: SecurityIssue[] = [];
  const config = getWorkerConfig();
  
  if (!config.security.enableSecurityScan) {
    return { safe: true, issues: [] };
  }
  
  const lines = code.split('\n');
  
  // Check for banned keywords
  lines.forEach((line, index) => {
    config.security.bannedKeywords.forEach(keyword => {
      if (line.includes(keyword)) {
        issues.push({
          type: 'suspicious_pattern',
          severity: 'high',
          description: `Potentially dangerous keyword '${keyword}' found`,
          line: index + 1,
          column: line.indexOf(keyword) + 1
        });
      }
    });
  });
  
  // Language-specific security checks
  switch (language) {
    case 'javascript':
      checkJavaScriptSecurity(code, issues);
      break;
    case 'python':
      checkPythonSecurity(code, issues);
      break;
    case 'java':
      checkJavaSecurity(code, issues);
      break;
    case 'cpp':
      checkCSecurity(code, issues);
      break;
  }
  
  // Determine if code is safe
  const criticalIssues = issues.filter(issue => issue.severity === 'critical');
  const highIssues = issues.filter(issue => issue.severity === 'high');
  
  const safe = criticalIssues.length === 0 && highIssues.length < 3;
  
  return { safe, issues };
};

// Language-specific security checks
const checkJavaScriptSecurity = (code: string, issues: SecurityIssue[]) => {
  const dangerousPatterns = [
    /require\s*\(\s*['"]child_process['"]\s*\)/,
    /require\s*\(\s*['"]fs['"]\s*\)/,
    /require\s*\(\s*['"]net['"]\s*\)/,
    /require\s*\(\s*['"]http['"]\s*\)/,
    /require\s*\(\s*['"]https['"]\s*\)/,
    /import\s+.*\s+from\s+['"]child_process['"]/,
    /import\s+.*\s+from\s+['"]fs['"]/,
    /import\s+.*\s+from\s+['"]net['"]/,
    /process\.exit/,
    /process\.kill/,
    /global\./,
    /Function\s*\(/,
    /new\s+Function/,
    /eval\s*\(/,
    /setTimeout\s*\(\s*['"].*['"]\s*\)/,
    /setInterval\s*\(\s*['"].*['"]\s*\)/
  ];
  
  dangerousPatterns.forEach(pattern => {
    const matches = code.match(pattern);
    if (matches) {
      issues.push({
        type: 'malicious_import',
        severity: 'critical',
        description: `Dangerous JavaScript pattern detected: ${matches[0]}`
      });
    }
  });
};

const checkPythonSecurity = (code: string, issues: SecurityIssue[]) => {
  const dangerousPatterns = [
    /import\s+os/,
    /import\s+sys/,
    /import\s+subprocess/,
    /import\s+socket/,
    /from\s+os\s+import/,
    /from\s+sys\s+import/,
    /from\s+subprocess\s+import/,
    /from\s+socket\s+import/,
    /exec\s*\(/,
    /eval\s*\(/,
    /compile\s*\(/,
    /__import__\s*\(/,
    /open\s*\(/,
    /file\s*\(/,
    /input\s*\(/,
    /raw_input\s*\(/
  ];
  
  dangerousPatterns.forEach(pattern => {
    const matches = code.match(pattern);
    if (matches) {
      issues.push({
        type: 'malicious_import',
        severity: 'critical',
        description: `Dangerous Python pattern detected: ${matches[0]}`
      });
    }
  });
};

const checkJavaSecurity = (code: string, issues: SecurityIssue[]) => {
  const dangerousPatterns = [
    /import\s+java\.io\./,
    /import\s+java\.net\./,
    /import\s+java\.nio\./,
    /import\s+java\.lang\.Runtime/,
    /import\s+java\.lang\.Process/,
    /import\s+java\.lang\.ProcessBuilder/,
    /Runtime\.getRuntime\(\)/,
    /ProcessBuilder/,
    /Class\.forName/,
    /Method\.invoke/,
    /Field\.set/,
    /System\.exit/,
    /System\.gc/,
    /Thread\./,
    /Unsafe\./
  ];
  
  dangerousPatterns.forEach(pattern => {
    const matches = code.match(pattern);
    if (matches) {
      issues.push({
        type: 'malicious_import',
        severity: 'critical',
        description: `Dangerous Java pattern detected: ${matches[0]}`
      });
    }
  });
};

const checkCSecurity = (code: string, issues: SecurityIssue[]) => {
  const dangerousPatterns = [
    /#include\s*<sys\/socket\.h>/,
    /#include\s*<unistd\.h>/,
    /#include\s*<sys\/stat\.h>/,
    /#include\s*<dirent\.h>/,
    /system\s*\(/,
    /exec\s*\(/,
    /fork\s*\(/,
    /signal\s*\(/,
    /fopen\s*\(/,
    /fwrite\s*\(/,
    /fread\s*\(/,
    /malloc\s*\(/,
    /free\s*\(/,
    /gets\s*\(/,
    /strcpy\s*\(/,
    /strcat\s*\(/
  ];
  
  dangerousPatterns.forEach(pattern => {
    const matches = code.match(pattern);
    if (matches) {
      issues.push({
        type: 'malicious_import',
        severity: 'high',
        description: `Dangerous C/C++ pattern detected: ${matches[0]}`
      });
    }
  });
};

// Memory utilities
export const parseMemoryLimit = (limit: string): number => {
  const match = limit.match(/^(\d+)([kmg]?)$/i);
  if (!match) {
    throw new Error(`Invalid memory limit format: ${limit}`);
  }
  
  const value = parseInt(match[1]);
  const unit = match[2]?.toLowerCase() || '';
  
  switch (unit) {
    case 'k':
      return value * 1024;
    case 'm':
      return value * 1024 * 1024;
    case 'g':
      return value * 1024 * 1024 * 1024;
    default:
      return value;
  }
};

export const formatMemorySize = (bytes: number): string => {
  if (bytes >= 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)}GB`;
  } else if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(2)}MB`;
  } else if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(2)}KB`;
  } else {
    return `${bytes}B`;
  }
};

// Time utilities
export const formatExecutionTime = (ms: number): string => {
  if (ms >= 1000) {
    return `${(ms / 1000).toFixed(2)}s`;
  } else {
    return `${ms}ms`;
  }
};

export const sleep = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

// Validation utilities
export const validateTimeout = (timeout: number): number => {
  const config = getWorkerConfig();
  return Math.min(Math.max(timeout, 1000), config.execution.maxTimeout);
};

export const validateMemoryLimit = (limit: string): string => {
  const config = getWorkerConfig();
  const limitBytes = parseMemoryLimit(limit);
  const maxLimitBytes = parseMemoryLimit(config.execution.maxMemoryLimit);
  
  if (limitBytes > maxLimitBytes) {
    return config.execution.maxMemoryLimit;
  }
  
  return limit;
};

export const generateExecutionId = (): string => {
  return `exec_${Date.now()}_${uuidv4().split('-')[0]}`;
};

// Error utilities
export const isTimeoutError = (error: Error): boolean => {
  return error.message.includes('timeout') || 
         error.message.includes('ETIMEDOUT') ||
         error.message.includes('ESRCH');
};

export const isMemoryError = (error: Error): boolean => {
  return error.message.includes('memory') ||
         error.message.includes('OOMKilled') ||
         error.message.includes('out of memory');
};

export const sanitizeError = (error: string): string => {
  // Remove sensitive information from error messages
  return error
    .replace(/\/tmp\/[^\/\s]+/g, '[TEMP_DIR]')
    .replace(/\/home\/[^\/\s]+/g, '[HOME_DIR]')
    .replace(/\/var\/[^\/\s]+/g, '[VAR_DIR]')
    .replace(/file:\/\/[^\s]+/g, '[FILE_URI]')
    .replace(/http:\/\/[^\s]+/g, '[HTTP_URI]')
    .replace(/https:\/\/[^\s]+/g, '[HTTPS_URI]')
    .replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, '[IP_ADDRESS]')
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL]');
};
