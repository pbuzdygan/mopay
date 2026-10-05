// Requires a built local image and Docker. Uses only disposable tmpfs data.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const exec = promisify(execFile);
const image = process.env.MOPAY_TEST_IMAGE || 'mopay-local-security:t015';
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

const customIdentity = (uid, gid) => `const assert=require('node:assert/strict');const fs=require('node:fs');assert.equal(process.getuid(),${uid});assert.equal(process.getgid(),${gid});assert.deepEqual(process.getgroups(),[${gid}]);assert.equal(process.pid,1);assert.equal(fs.statSync('/app').uid,1000);assert.equal(fs.statSync('/app').gid,1000);assert.equal(process.env.DB_FILE,'/data/mopay.sqlite');const Database=require('better-sqlite3');const db=new Database(process.env.DB_FILE);db.pragma('journal_mode = WAL');db.exec('CREATE TABLE fixture(value TEXT)');db.prepare('INSERT INTO fixture VALUES (?)').run('synthetic');for(const path of ['/data/mopay.sqlite','/data/mopay.sqlite-wal','/data/mopay.sqlite-shm']){const stat=fs.statSync(path);assert.equal(stat.uid,${uid});assert.equal(stat.gid,${gid});}db.close();console.log('PASS');`;

for (const [uid, gid, env] of [
  [2000, 3000, ['PUID=2000', 'PGID=3000']],
  [2000, 1000, ['PUID=2000']],
  [1000, 3000, ['PGID=3000']],
  [1000, 1000, ['PUID=', 'PGID=']],
]) {
  test(`numeric identity ${uid}:${gid} owns database and WAL files`, async () => {
    const { stdout } = await exec('docker', [...base, '--tmpfs', '/data:rw,nosuid,nodev,size=4m,mode=0700', ...env.flatMap(value => ['-e', value]), image, 'node', '-e', customIdentity(uid, gid)]);
    assert.equal(stdout.trim(), 'PASS');
  });
}

test('explicit numeric non-root user starts with matching configuration', async () => {
  const { stdout } = await exec('docker', [...base, '--user', '2000:3000', '-e', 'PUID=2000', '-e', 'PGID=3000', '--tmpfs', '/data:rw,nosuid,nodev,size=4m,uid=2000,gid=3000,mode=0700', image, 'node', '-e', customIdentity(2000, 3000)]);
  assert.equal(stdout.trim(), 'PASS');
});

for (const name of ['PUID', 'PGID']) {
  test(`${name} rejects root and malformed IDs before starting`, async () => {
    for (const value of ['0', '-1', '01', '+1000', ' 1000', '1000\n', 'node', '1;id', '2147483648', '999999999999999999999']) {
      await assert.rejects(exec('docker', [...base, '-e', `${name}=${value}`, image, 'node', '-e', "console.log('UNSAFE_START')"]), error => {
        assert.equal(error.code, 64);
        assert.match(error.stderr, new RegExp(`${name} must be a decimal ID`));
        assert.equal(error.stdout, '');
        return true;
      });
    }
  });
}

test('mismatched explicit container user fails instead of ignoring configured identity', async () => {
  await assert.rejects(exec('docker', [...base, '--user', 'node', '-e', 'PUID=2000', image, 'node', '-e', "console.log('UNSAFE_START')"]), error => {
    assert.equal(error.code, 64);
    assert.match(error.stderr, /Container user must match/);
    assert.equal(error.stdout, '');
    return true;
  });
});

test('existing database transitions from default owner to custom owner and back', async () => {
  const fixture = `const fs=require('node:fs');const Database=require('better-sqlite3');const db=new Database('/data/mopay.sqlite');db.exec("CREATE TABLE fixture(value TEXT); INSERT INTO fixture VALUES ('preserved')");db.close();fs.chownSync('/data/mopay.sqlite',1000,1000);fs.chmodSync('/data/mopay.sqlite',0o400);fs.writeFileSync('/data/sentinel','keep');fs.chownSync('/data/sentinel',1000,1000);`;
  const verify = `const assert=require('node:assert/strict');const fs=require('node:fs');const Database=require('better-sqlite3');const db=new Database(process.env.DB_FILE);assert.equal(db.prepare('SELECT value FROM fixture').get().value,'preserved');db.exec("INSERT INTO fixture VALUES ('written')");assert.equal(fs.statSync(process.env.DB_FILE).uid,Number(process.env.PUID));assert.equal(fs.statSync(process.env.DB_FILE).gid,Number(process.env.PGID));assert.equal(fs.readFileSync('/data/sentinel','utf8'),'keep');db.close();`;
  const { stdout } = await exec('docker', [...base, '--tmpfs', '/data:rw,nosuid,nodev,size=4m,mode=0700', '--entrypoint', 'sh', image, '-c', 'node -e "$1" && PUID=2000 PGID=3000 /usr/local/bin/docker-entrypoint.sh node -e "$2" && PUID=1000 PGID=1000 /usr/local/bin/docker-entrypoint.sh node -e "$2" && echo PASS', 'fixture', fixture, verify]);
  assert.equal(stdout.trim(), 'PASS');
});

test('unwritable existing database fails as final user', async () => {
  await assert.rejects(exec('docker', [...base, '--tmpfs', '/data:rw,nosuid,nodev,size=4m,mode=0777', '-e', 'PUID=2000', '-e', 'PGID=3000', '--entrypoint', 'sh', image, '-c', 'touch /data/mopay.sqlite && chmod 0400 /data/mopay.sqlite && exec setpriv --reuid=2000 --regid=3000 --clear-groups /usr/local/bin/docker-entrypoint.sh node -e "$1"', 'fixture', "console.log('UNSAFE_START')"]), error => {
    assert.equal(error.code, 70);
    assert.match(error.stderr, /Database file is not writable/);
    assert.equal(error.stdout, '');
    return true;
  });
});

test('ownership repair failure denies startup', async () => {
  await assert.rejects(exec('docker', [...base, '--cap-drop', 'CHOWN', '-e', 'PUID=2000', '-e', 'PGID=3000', '--tmpfs', '/data:rw,nosuid,nodev,size=4m,mode=0700', image, 'node', '-e', "console.log('UNSAFE_START')"]), error => {
    assert.equal(error.code, 70);
    assert.match(error.stderr, /Cannot prepare \/data/);
    assert.equal(error.stdout, '');
    return true;
  });
});

test('nested DB directory is created as the selected user', async () => {
  const probe = `const assert=require('node:assert/strict');const fs=require('node:fs');const Database=require('better-sqlite3');const db=new Database(process.env.DB_FILE);db.exec('CREATE TABLE fixture(value TEXT)');db.close();for(const path of ['/data/nested','/data/nested/mopay.sqlite']){assert.equal(fs.statSync(path).uid,2000);assert.equal(fs.statSync(path).gid,3000);}console.log('PASS');`;
  const { stdout } = await exec('docker', [...base, '-e', 'PUID=2000', '-e', 'PGID=3000', '-e', 'DB_FILE=/data/nested/mopay.sqlite', '--tmpfs', '/data:rw,nosuid,nodev,size=4m,mode=0700', image, 'node', '-e', probe]);
  assert.equal(stdout.trim(), 'PASS');
});
