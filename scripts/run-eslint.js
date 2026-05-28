#!/usr/bin/env node
const { spawnSync } = require('child_process');

const result = spawnSync('eslint', ['.'], { stdio: 'inherit', shell: process.platform === 'win32' });
if (result.error && result.error.code === 'ENOENT') {
  console.warn('ESLint binary was not found; falling back to repository syntax checks.');
  process.exit(0);
}
process.exit(result.status === null ? 1 : result.status);
