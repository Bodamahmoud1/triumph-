#!/usr/bin/env node
const { execFileSync } = require('child_process');
const { existsSync } = require('fs');

function gitFiles(pattern) {
  const out = execFileSync('git', ['ls-files', pattern], { encoding: 'utf8' });
  return out.split('\n').filter(Boolean);
}

const jsFiles = gitFiles('*.js');
const errors = [];

for (const file of jsFiles) {
  if (!existsSync(file)) continue;
  try {
    execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
  } catch (error) {
    errors.push(`Syntax check failed: ${file}\n${error.stderr || error.message}`);
  }
}

const trackedSensitive = execFileSync('git', ['ls-files'], { encoding: 'utf8' })
  .split('\n')
  .filter((file) => file && (/^server\/uploads\//.test(file) || /^server\/.*\.db$/.test(file)));

if (trackedSensitive.length) {
  errors.push(`Sensitive runtime files are tracked:\n${trackedSensitive.join('\n')}`);
}

if (errors.length) {
  console.error(errors.join('\n\n'));
  process.exit(1);
}

console.log(`Lint passed: ${jsFiles.length} JavaScript files parsed and no sensitive runtime files are tracked.`);
