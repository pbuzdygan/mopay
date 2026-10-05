// Requires a built local image and Docker. Uses only disposable tmpfs data.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const exec = promisify(execFile);
const image = process.env.MOPAY_TEST_IMAGE || 'mopay-local-security:t012';
const base = ['run', '--rm', '--network', 'none', '--read-only'];
const identity = `const assert=require('node:assert/strict');const fs=require('node:fs');assert.equal(process.getuid(),1000);assert.equal(process.getgid(),1000);assert.deepEqual(process.getgroups(),[1000]);assert.equal(process.pid,1);fs.writeFileSync('/data/fixture','synthetic');console.log('PASS');`;

test('root entrypoint repairs disposable data permissions and execs as node/PID 1', async () => {
  const { stdout } = await exec('docker', [...base, '--tmpfs', '/data:rw,nosuid,nodev,size=4m,mode=0700', image, 'node', '-e', identity]);
  assert.equal(stdout.trim(), 'PASS');
});

test('explicit node user can start with its own writable data directory', async () => {
  const { stdout } = await exec('docker', [...base, '--user', 'node', '--tmpfs', '/data:rw,nosuid,nodev,size=4m,uid=1000,gid=1000,mode=0700', image, 'node', '-e', identity]);
  assert.equal(stdout.trim(), 'PASS');
});

test('non-root unwritable data denies startup rather than running the command', async () => {
  await assert.rejects(exec('docker', [...base, '--user', 'node', '--tmpfs', '/data:rw,nosuid,nodev,size=4m,mode=0555', image, 'node', '-e', "console.log('UNSAFE_START')"]), error => {
    assert.equal(error.code, 70);
    assert.match(error.stderr, /Database directory is not writable/);
    assert.equal(error.stdout, '');
    return true;
  });
});

test('failure to drop root privileges denies startup', async () => {
  await assert.rejects(exec('docker', [...base, '--cap-drop', 'SETUID', '--tmpfs', '/data:rw,nosuid,nodev,size=4m', image, 'node', '-e', "console.log('UNSAFE_START')"]), error => {
    assert.notEqual(error.code, 0);
    assert.match(error.stderr, /setpriv:/);
    assert.equal(error.stdout, '');
    return true;
  });
});

test('PID 1 receives SIGTERM and exits cleanly', async () => {
  const { stdout } = await exec('docker', ['run', '-d', '--network', 'none', '--read-only', '--tmpfs', '/data:rw,nosuid,nodev,size=4m', image, 'node', '-e', `process.on('SIGTERM',()=>{console.log('TERM');process.exit(0)});console.log('READY');setInterval(()=>{},1000);`]);
  const id = stdout.trim();
  try {
    let ready = false;
    for (let i = 0; i < 40; i++) {
      if ((await exec('docker', ['logs', id])).stdout.includes('READY')) { ready = true; break; }
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    assert.ok(ready);
    await exec('docker', ['stop', '--time', '2', id]);
    assert.match((await exec('docker', ['logs', id])).stdout, /TERM/);
    assert.equal((await exec('docker', ['inspect', '--format', '{{.State.ExitCode}}', id])).stdout.trim(), '0');
  } finally {
    await exec('docker', ['rm', '-f', id]);
  }
});
