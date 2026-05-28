#!/usr/bin/env node
const { execFileSync } = require('child_process');
const { readFileSync, existsSync } = require('fs');

const files = execFileSync('git', ['ls-files'], { encoding: 'utf8' })
  .split('\n')
  .filter(Boolean)
  .filter((file) => /\.(json|webmanifest)$/.test(file));

const errors = [];

for (const file of files) {
  if (!existsSync(file)) continue;
  const text = readFileSync(file, 'utf8');
  try {
    JSON.parse(text);
  } catch (error) {
    errors.push(`${file}: invalid JSON (${error.message})`);
  }
  if (!text.endsWith('\n')) {
    errors.push(`${file}: missing trailing newline`);
  }
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}

console.log(`Format check passed: ${files.length} JSON manifest files parsed.`);
