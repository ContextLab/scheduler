/**
 * Runs every backend/*.test.js as a child process and aggregates results.
 * Each test file self-reports and exits non-zero on failure.
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const dir = __dirname;
const files = fs.readdirSync(dir)
  .filter((f) => f.endsWith('.test.js'))
  .sort();

let failedFiles = 0;
files.forEach((f) => {
  const res = spawnSync(process.execPath, [path.join(dir, f)], { stdio: 'inherit' });
  if (res.status !== 0) failedFiles++;
  console.log('');
});

if (failedFiles > 0) {
  console.log(failedFiles + ' backend test file(s) failed.');
  process.exit(1);
}
console.log('All backend test files passed.');
