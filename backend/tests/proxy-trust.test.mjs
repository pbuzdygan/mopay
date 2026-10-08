import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';

const require = createRequire(import.meta.url);
const proxyaddr = require('proxy-addr');
const request = (remoteAddress) => ({
  socket: { remoteAddress },
  headers: { 'x-forwarded-for': '203.0.113.42' },
});

test('IPv6 trust subnets do not trust unrelated IPv4 clients (GHSA-jqcg-44mw-7w3h)', () => {
  for (const subnet of ['::ffff:10.0.0.0/8', '::/1']) {
    const trust = proxyaddr.compile(subnet);
    assert.equal(proxyaddr(request('198.51.100.23'), trust), '198.51.100.23', subnet);
  }
});

test('valid IPv4 and mapped IPv6 trust subnets preserve trusted proxy behavior', () => {
  for (const subnet of ['10.0.0.0/8', '::ffff:10.0.0.0/104']) {
    const trust = proxyaddr.compile(subnet);
    for (const address of ['10.1.2.3', '::ffff:10.1.2.3']) {
      assert.equal(proxyaddr(request(address), trust), '203.0.113.42');
    }
    assert.equal(proxyaddr(request('198.51.100.23'), trust), '198.51.100.23');
  }
});
