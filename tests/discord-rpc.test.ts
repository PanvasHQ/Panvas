import assert from 'node:assert/strict';
import test from 'node:test';
import net from 'node:net';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import {
  DISCORD_APP_ID,
  DISCORD_ASSET_KEY,
  DiscordPresenceService,
  buildPanvasActivity,
  validateActivityPrivacy,
  initDiscordRpc,
  destroyDiscordRpc,
  getDiscordRpcService,
} from '../electron/discord-rpc.ts';

test('Discord Rich Presence configuration constants match approved specification', () => {
  assert.equal(DISCORD_APP_ID, '15468798695997758576');
  assert.equal(DISCORD_ASSET_KEY, 'panvas-logo_1');
});

test('activity payload contains only approved fields and strictly zero user/document metadata', () => {
  const activity = buildPanvasActivity();

  assert.equal(activity.details, 'Using Panvas');
  assert.equal(activity.assets.large_image, 'panvas-logo_1');
  assert.equal(activity.assets.large_text, 'Panvas');

  // Strict privacy validation
  assert.equal(validateActivityPrivacy(activity), true);

  // Ensure forbidden document/user metadata keys are rejected
  const forbiddenMutations = [
    { ...activity, workspace: 'My Secret Research' },
    { ...activity, notebook: 'Calculus Notes' },
    { ...activity, page: 'Page 1' },
    { ...activity, title: 'Document Title' },
    { ...activity, pdf: 'contract.pdf' },
    { ...activity, user: 'test@example.com' },
    { ...activity, email: 'student@university.edu' },
    { ...activity, content: 'User typed text' },
    { ...activity, details: 'Editing Calculus Notes' },
  ];

  for (const mutated of forbiddenMutations) {
    assert.equal(
      validateActivityPrivacy(mutated),
      false,
      `Mutated payload should be rejected for privacy: ${JSON.stringify(mutated)}`,
    );
  }

  // Exact JSON key structure check
  const keys = Object.keys(activity).sort();
  assert.deepEqual(keys, ['assets', 'details']);
  const assetKeys = Object.keys(activity.assets).sort();
  assert.deepEqual(assetKeys, ['large_image', 'large_text']);
});

test('desktop-only isolation: browser frontend never imports or references Discord RPC', async () => {
  const [bootstrapTsx, appTsx, packageJson] = await Promise.all([
    readFile(path.resolve('src/bootstrap.tsx'), 'utf8'),
    readFile(path.resolve('src/app/App.tsx'), 'utf8'),
    readFile(path.resolve('package.json'), 'utf8'),
  ]);

  // Browser bundle root must have zero Discord references
  assert.doesNotMatch(bootstrapTsx, /discord/i);
  assert.doesNotMatch(appTsx, /discord/i);

  // package.json dependencies must NOT include bot/SDK packages
  const pkg = JSON.parse(packageJson);
  const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
  assert.equal('discord.js' in allDeps, false);
  assert.equal('discord-rpc' in allDeps, false);
  assert.equal('@discordjs/core' in allDeps, false);
});

test('Discord unavailable does not crash Panvas and gracefully schedules retry', async () => {
  const nonExistentPipe = process.platform === 'win32'
    ? `\\\\?\\pipe\\panvas-nonexistent-pipe-${Date.now()}`
    : `/tmp/panvas-nonexistent-pipe-${Date.now()}`;

  const service = new DiscordPresenceService({
    customPipePath: nonExistentPipe,
    reconnectIntervalMs: 50,
  });

  // start() should run asynchronously and not throw
  service.start();
  assert.equal(service.isConnectedToDiscord(), false);

  // Methods called when disconnected must be safe no-ops
  assert.doesNotThrow(() => service.sendActivity());
  assert.doesNotThrow(() => service.clearActivity());

  // Wait a short duration for the failed connection attempt to settle
  await new Promise(resolve => setTimeout(resolve, 80));
  assert.equal(service.isConnectedToDiscord(), false);

  // Clean up
  service.destroy();
  const status = service.getStatus();
  assert.equal(status.destroyed, true);
  assert.equal(status.connected, false);
});

test('end-to-end local IPC handshake and activity dispatch against a mock Discord IPC server', async () => {
  const pipeName = process.platform === 'win32'
    ? `\\\\?\\pipe\\panvas-test-mock-rpc-${Date.now()}`
    : `/tmp/panvas-test-mock-rpc-${Date.now()}`;

  let serverReceivedHandshake: any = null;
  let serverReceivedActivityPayload: any = null;

  const server = net.createServer((clientSocket) => {
    let buf = Buffer.alloc(0);

    clientSocket.on('data', (chunk) => {
      buf = Buffer.concat([buf, chunk]);
      while (buf.length >= 8) {
        const opcode = buf.readUInt32LE(0);
        const length = buf.readUInt32LE(4);
        if (buf.length < 8 + length) break;

        const payloadStr = buf.subarray(8, 8 + length).toString('utf8');
        buf = buf.subarray(8 + length);
        const payload = JSON.parse(payloadStr);

        if (opcode === 0) {
          // Handshake received
          serverReceivedHandshake = payload;

          // Respond with READY frame (Opcode 1)
          const readyPayload = Buffer.from(JSON.stringify({ cmd: 'DISPATCH', evt: 'READY' }), 'utf8');
          const header = Buffer.alloc(8);
          header.writeUInt32LE(1, 0);
          header.writeUInt32LE(readyPayload.length, 4);
          clientSocket.write(Buffer.concat([header, readyPayload]));
        } else if (opcode === 1 && payload.cmd === 'SET_ACTIVITY') {
          // Set activity received
          serverReceivedActivityPayload = payload;
        }
      }
    });
  });

  await new Promise<void>((resolve) => server.listen(pipeName, () => resolve()));

  try {
    const service = new DiscordPresenceService({
      customPipePath: pipeName,
      reconnectIntervalMs: 500,
    });

    service.start();

    // Wait for handshake and activity exchange
    const deadline = Date.now() + 4000;
    while ((!serverReceivedHandshake || !serverReceivedActivityPayload) && Date.now() < deadline) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    // Verify handshake
    assert.ok(serverReceivedHandshake, 'Server should have received handshake');
    assert.equal(serverReceivedHandshake.v, 1);
    assert.equal(serverReceivedHandshake.client_id, DISCORD_APP_ID);

    // Verify activity payload
    assert.ok(serverReceivedActivityPayload, 'Server should have received SET_ACTIVITY');
    assert.equal(serverReceivedActivityPayload.cmd, 'SET_ACTIVITY');
    const act = serverReceivedActivityPayload.args?.activity;
    assert.ok(act, 'Activity object present');
    assert.equal(act.details, 'Using Panvas');
    assert.equal(act.assets?.large_image, 'panvas-logo_1');
    assert.equal(act.assets?.large_text, 'Panvas');
    assert.equal(validateActivityPrivacy(act), true);

    assert.equal(service.isConnectedToDiscord(), true);

    // Test teardown / cleanup on quit
    service.destroy();
    assert.equal(service.isConnectedToDiscord(), false);
    assert.equal(service.getStatus().destroyed, true);
  } finally {
    server.close();
  }
});

test('global lifecycle: initDiscordRpc and destroyDiscordRpc behave idempotently', () => {
  destroyDiscordRpc(); // Ensure clean slate
  assert.equal(getDiscordRpcService(), null);

  const nonExistentPipe = process.platform === 'win32'
    ? `\\\\?\\pipe\\panvas-mock-global-${Date.now()}`
    : `/tmp/panvas-mock-global-${Date.now()}`;

  const service1 = initDiscordRpc({ customPipePath: nonExistentPipe });
  assert.ok(service1);
  assert.equal(getDiscordRpcService(), service1);

  // Second call returns existing instance
  const service2 = initDiscordRpc();
  assert.equal(service1, service2);

  // Teardown
  destroyDiscordRpc();
  assert.equal(getDiscordRpcService(), null);
  assert.equal(service1.getStatus().destroyed, true);

  // Subsequent teardown is safe
  assert.doesNotThrow(() => destroyDiscordRpc());
});
