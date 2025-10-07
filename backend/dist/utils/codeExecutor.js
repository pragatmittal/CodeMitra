"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.executeCode = executeCode;
const child_process_1 = require("child_process");
const promises_1 = require("fs/promises");
const path_1 = require("path");
const crypto_1 = require("crypto");
async function executeCode(code, language) {
    const startTime = Date.now();
    const fileId = (0, crypto_1.randomUUID)();
    let fileName;
    let command;
    let args;
    switch (language) {
        case 'javascript':
            fileName = `${fileId}.js`;
            command = 'node';
            args = [(0, path_1.join)('/tmp', fileName)];
            break;
        case 'python':
            fileName = `${fileId}.py`;
            command = 'python3';
            args = [(0, path_1.join)('/tmp', fileName)];
            break;
        case 'java':
            fileName = `${fileId}.java`;
            command = 'java';
            args = ['-cp', '/tmp', 'Code'];
            break;
        case 'cpp':
            fileName = `${fileId}.cpp`;
            command = 'g++';
            args = ['-o', (0, path_1.join)('/tmp', fileId), (0, path_1.join)('/tmp', fileName), '&&', (0, path_1.join)('/tmp', fileId)];
            break;
        default:
            throw new Error(`Unsupported language: ${language}`);
    }
    try {
        await (0, promises_1.writeFile)((0, path_1.join)('/tmp', fileName), code);
        const result = await executeCommand(command, args, 10000);
        await cleanupFiles(fileName, fileId, language);
        return {
            output: result.stdout,
            error: result.stderr,
            executionTime: Date.now() - startTime,
            status: result.exitCode === 0 ? 'success' : 'error'
        };
    }
    catch (error) {
        await cleanupFiles(fileName, fileId, language);
        return {
            output: '',
            error: error instanceof Error ? error.message : 'Unknown error',
            executionTime: Date.now() - startTime,
            status: 'error'
        };
    }
}
function executeCommand(command, args, timeout) {
    return new Promise((resolve, reject) => {
        const process = (0, child_process_1.spawn)(command, args, {
            cwd: '/tmp',
            timeout
        });
        let stdout = '';
        let stderr = '';
        process.stdout.on('data', (data) => {
            stdout += data.toString();
        });
        process.stderr.on('data', (data) => {
            stderr += data.toString();
        });
        process.on('close', (code) => {
            resolve({
                stdout,
                stderr,
                exitCode: code || 0
            });
        });
        process.on('error', (error) => {
            reject(error);
        });
    });
}
async function cleanupFiles(fileName, fileId, language) {
    try {
        await (0, promises_1.unlink)((0, path_1.join)('/tmp', fileName));
        if (language === 'cpp') {
            await (0, promises_1.unlink)((0, path_1.join)('/tmp', fileId));
        }
        if (language === 'java') {
            await (0, promises_1.unlink)((0, path_1.join)('/tmp', 'Code.class'));
        }
    }
    catch (error) {
        console.warn('Cleanup warning:', error);
    }
}
//# sourceMappingURL=codeExecutor.js.map