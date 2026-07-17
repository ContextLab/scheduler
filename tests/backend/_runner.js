/** Tiny zero-dependency test runner shared by the backend .gs integration tests. */
function createRunner(title) {
  let passed = 0;
  let failed = 0;
  const failures = [];
  if (title) console.log(title);

  function test(name, fn) {
    try {
      fn();
      passed++;
      console.log('  ✓ ' + name);
    } catch (e) {
      failed++;
      failures.push(name);
      console.log('  ✗ ' + name + '\n      ' + e.message);
    }
  }

  function done() {
    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    return failed;
  }

  return { test: test, done: done };
}

module.exports = { createRunner };
