import { Language } from '../types';

export const SUPPORTED_LANGUAGES: { [key: string]: Language } = {
  javascript: {
    id: 'javascript',
    name: 'JavaScript',
    version: '18.x',
    extension: 'js',
    dockerImage: 'node:18-alpine',
    runCommand: 'node main.js',
    timeout: 30000,
    memoryLimit: '256m',
    allowedPackages: ['fs', 'path', 'util', 'crypto', 'os'],
    bannedImports: ['child_process', 'cluster', 'dgram', 'dns', 'net', 'tls', 'http', 'https']
  },

  python: {
    id: 'python',
    name: 'Python',
    version: '3.11',
    extension: 'py',
    dockerImage: 'python:3.11-alpine',
    runCommand: 'python main.py',
    timeout: 30000,
    memoryLimit: '256m',
    allowedPackages: ['math', 'random', 'datetime', 'json', 'collections', 'itertools', 'functools', 'operator', 're'],
    bannedImports: ['os', 'sys', 'subprocess', 'socket', 'urllib', 'requests', 'http', 'ftplib', 'smtplib', 'telnetlib', 'eval', 'exec', 'compile', '__import__']
  },

  java: {
    id: 'java',
    name: 'Java',
    version: '17',
    extension: 'java',
    dockerImage: 'eclipse-temurin:17-jdk',
    compileCommand: 'javac Main.java',
    runCommand: 'java Main',
    timeout: 30000,
    memoryLimit: '512m',
    allowedPackages: ['java.util.*', 'java.lang.*', 'java.math.*', 'java.text.*'],
    bannedImports: ['java.io.*', 'java.net.*', 'java.nio.*', 'java.rmi.*', 'java.security.*', 'javax.net.*', 'java.lang.Runtime', 'java.lang.Process', 'java.lang.ProcessBuilder']
  },

  cpp: {
    id: 'cpp',
    name: 'C++',
    version: '17',
    extension: 'cpp',
    dockerImage: 'gcc:11-alpine',
    compileCommand: 'g++ -std=c++17 -O2 -Wall -Wextra -o main main.cpp',
    runCommand: './main',
    timeout: 45000,
    memoryLimit: '256m',
    allowedPackages: ['iostream', 'vector', 'string', 'algorithm', 'map', 'set', 'queue', 'stack', 'deque', 'list', 'utility', 'cmath', 'cstdlib', 'cstring', 'ctime'],
    bannedImports: ['system', 'exec', 'fork', 'signal', 'unistd.h', 'sys/socket.h', 'netinet/in.h', 'arpa/inet.h', 'sys/stat.h', 'sys/types.h', 'dirent.h']
  }
};

export const getLanguageById = (id: string): Language | undefined => {
  return SUPPORTED_LANGUAGES[id];
};

export const getSupportedLanguages = (): Language[] => {
  return Object.values(SUPPORTED_LANGUAGES);
};

export const isLanguageSupported = (id: string): boolean => {
  return id in SUPPORTED_LANGUAGES;
};

export const getDefaultCode = (languageId: string): string => {
  const defaultCodes: { [key: string]: string } = {
    javascript: `console.log("Hello, World!");`,
    
    python: `print("Hello, World!")`,
    
    java: `public class Main {
    public static void main(String[] args) {
        System.out.println("Hello, World!");
    }
}`,
    
    cpp: `#include <iostream>
using namespace std;

int main() {
    cout << "Hello, World!" << endl;
    return 0;
}`
  };
  
  return defaultCodes[languageId] || '';
};

export const getFileName = (languageId: string, className?: string): string => {
  const language = getLanguageById(languageId);
  if (!language) {
    throw new Error(`Unsupported language: ${languageId}`);
  }
  
  // Special cases for languages that require specific file names
  if (languageId === 'java') {
    return `${className || 'Main'}.${language.extension}`;
  }
  
  return `main.${language.extension}`;
};

export const extractClassName = (code: string, languageId: string): string | undefined => {
  if (languageId === 'java') {
    const match = code.match(/public\s+class\s+(\w+)/);
    return match ? match[1] : 'Main';
  }
  
  return undefined;
};
