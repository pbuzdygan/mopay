import assert from 'node:assert/strict';
import { test } from 'node:test';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
const exec = promisify(execFile);
const image = process.env.MOPAY_TEST_IMAGE || 'mopay-local-review:demo';
const fixture = fileURLToPath(new URL('./fixtures/demo-lifecycle.mjs', import.meta.url));

test('container demo lifecycle uses separate owned storage and preserves normal data/PIN', async () => {
  const { stdout } = await exec('docker', ['run', '--rm', '--network', 'none', '--read-only', '--security-opt', 'no-new-privileges:true', '--user', '1000:1000', '--tmpfs', '/data:rw,nosuid,nodev,size=16m,uid=1000,gid=1000,mode=0700', '--tmpfs', '/tmp:rw,nosuid,nodev,size=16m,mode=1777', '--mount', `type=bind,src=${fixture},dst=/verify.mjs,readonly`, image, 'node', '/verify.mjs'], { timeout: 30000 });
  assert.equal(stdout.trim(), 'PASS');
});
