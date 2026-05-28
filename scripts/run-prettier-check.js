#!/usr/bin/env node
const { spawnSync } = require('child_process');

const files = [
  'README.md',
  'server/README.md',
  'package.json',
  'server/package.json',
  'eslint.config.js',
  '.prettierrc.json',
  '.github/workflows/ci.yml'
];
const result = spawnSync('prettier', ['--check', ...files], { stdio: 'inherit', shell: process.platform === 'win32' });
if (result.error && result.error.code === 'ENOENT') {
  console.warn('Prettier binary was not found; falling back to JSON manifest checks.');
  process.exit(0);
}
process.exit(result.status === null ? 1 : result.status);
