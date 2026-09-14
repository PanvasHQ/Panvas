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
  assert.equal(DISCORD_APP_ID, '1546879865997758576');
  assert.equal(DISCORD_ASSET_KEY, 'panvas-logo_1');
});

test('activity payload contains only approved fields and strictly zero user/document metadata', () => {
  const activity = buildPanvasActivity();

  assert.equal(activity.type, 0);
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
  assert.deepEqual(keys, ['assets', 'details', 'type']);
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

test('electron main process wires initDiscordRpc during app readiness for development and packaged builds', async () => {
  const mainTs = await readFile(path.resolve('electron/main.ts'), 'utf8');
  assert.match(mainTs, /import\s+{[^}]*initDiscordRpc[^}]*}\s+from\s+['"]\.\/discord-rpc\.js['"]/);
  assert.match(mainTs, /import\s+{[^}]*destroyDiscordRpc[^}]*}\s+from\s+['"]\.\/discord-rpc\.js['"]/);
  assert.match(mainTs, /app\.whenReady\(\)\.then\(\(\)\s*=>\s*{[\s\S]*initDiscordRpc\({[\s\S]*debugLogs:\s*!app\.isPackaged/);
  assert.match(mainTs, /app\.on\(['"]before-quit['"],\s*\(\)\s*=>\s*{[\s\S]*destroyDiscordRpc\(\)/);
});

test('development-only logs capture initialization, connection failure, and retry when Discord is unavailable', async () => {
  const logs: { level: string; msg: string }[] = [];
  const nonExistentPipe = process.platform === 'win32'
    ? `\\\\?\\pipe\\panvas-log-test-nonexistent-${Date.now()}`
    : `/tmp/panvas-log-test-nonexistent-${Date.now()}`;

  const service = new DiscordPresenceService({
    customPipePath: nonExistentPipe,
    debugLogs: true,
    logger: (level, msg) => logs.push({ level, msg }),
    reconnectIntervalMs: 50,
  });

  service.start();
  await new Promise(resolve => setTimeout(resolve, 80));

  // Verify initialization log
  const initLog = logs.find(l => l.msg.includes('RPC initialized'));
  assert.ok(initLog, 'Initialization should be logged');
  assert.ok(initLog.msg.includes('1546879865997758576'), 'Initialization log includes App ID');
  assert.ok(initLog.msg.includes('panvas-logo_1'), 'Initialization log includes Asset Key');

  // Verify connection failure log
  const failLog = logs.find(l => l.msg.includes('Connection failure'));
  assert.ok(failLog, 'Connection failure should be logged in development mode');

  service.destroy();
});

test('development-only logs capture connection success and activity publish against mock Discord server', async () => {
  const logs: { level: string; msg: string }[] = [];
  const pipeName = process.platform === 'win32'
    ? `\\\\?\\pipe\\panvas-log-test-mock-${Date.now()}`
    : `/tmp/panvas-log-test-mock-${Date.now()}`;

  const server = net.createServer((clientSocket) => {
    let buf = Buffer.alloc(0);
    clientSocket.on('data', (chunk) => {
      buf = Buffer.concat([buf, chunk]);
      while (buf.length >= 8) {
        const opcode = buf.readUInt32LE(0);
        const length = buf.readUInt32LE(4);
        if (buf.length < 8 + length) break;
        buf = buf.subarray(8 + length);
        if (opcode === 0) {
          const readyPayload = Buffer.from(JSON.stringify({ cmd: 'DISPATCH', evt: 'READY' }), 'utf8');
          const header = Buffer.alloc(8);
          header.writeUInt32LE(1, 0);
          header.writeUInt32LE(readyPayload.length, 4);
          clientSocket.write(Buffer.concat([header, readyPayload]));
        }
      }
    });
  });

  await new Promise<void>((resolve) => server.listen(pipeName, () => resolve()));

  try {
    const service = new DiscordPresenceService({
      customPipePath: pipeName,
      debugLogs: true,
      logger: (level, msg) => logs.push({ level, msg }),
      reconnectIntervalMs: 500,
    });

    service.start();

    const deadline = Date.now() + 4000;
    while (!logs.some(l => l.msg.includes('Activity sent; awaiting Discord acknowledgment')) && Date.now() < deadline) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    // Verify connection success log
    const connectLog = logs.find(l => l.msg.includes('Connected to Discord IPC'));
    assert.ok(connectLog, 'Connection success should be logged');

    // Verify activity publish success log
    const pubLog = logs.find(l => l.msg.includes('Activity sent; awaiting Discord acknowledgment'));
    assert.ok(pubLog, 'Activity publish success should be logged');
    assert.ok(pubLog.msg.includes('Using Panvas'));
    assert.ok(pubLog.msg.includes('panvas-logo_1'));

    service.destroy();
  } finally {
    server.close();
  }
});

test('production mode stays completely silent when debugLogs is false', async () => {
  const logs: { level: string; msg: string }[] = [];
  const nonExistentPipe = process.platform === 'win32'
    ? `\\\\?\\pipe\\panvas-silent-test-${Date.now()}`
    : `/tmp/panvas-silent-test-${Date.now()}`;

  const service = new DiscordPresenceService({
    customPipePath: nonExistentPipe,
    debugLogs: false,
    logger: (level, msg) => logs.push({ level, msg }),
    reconnectIntervalMs: 50,
  });

  service.start();
  await new Promise(resolve => setTimeout(resolve, 80));
  service.sendActivity();
  service.destroy();

  assert.equal(logs.length, 0, 'No logs should be emitted in production mode');
});

test('security assurance: zero client secrets, bot tokens, public keys, or OAuth tokens in implementation', async () => {
  const rpcCode = await readFile(path.resolve('electron/discord-rpc.ts'), 'utf8');
  const codeWithoutComments = rpcCode.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');
  assert.doesNotMatch(codeWithoutComments, /client_secret|clientSecret/i);
  assert.doesNotMatch(codeWithoutComments, /bot_token|botToken/i);
  assert.doesNotMatch(codeWithoutComments, /public_key|publicKey/i);
  assert.doesNotMatch(codeWithoutComments, /oauth|bearer/i);
});


function frame(opcode: number, payload: unknown): Buffer {
  const bytes = Buffer.isBuffer(payload) ? payload : Buffer.from(JSON.stringify(payload), 'utf8');
  const header = Buffer.alloc(8);
  header.writeUInt32LE(opcode, 0); header.writeUInt32LE(bytes.length, 4);
  return Buffer.concat([header, bytes]);
}

async function waitFor(predicate: () => boolean) {
  const deadline = Date.now() + 2000;
  while (!predicate() && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 10));
  assert.ok(predicate(), 'Expected IPC event before deadline');
}

test('fragmented READY gates activity; only matching acknowledgment confirms it; PING preserves bytes', async () => {
  const pipe = process.platform === 'win32' ? `\\\\?\\pipe\\panvas-protocol-${Date.now()}` : `/tmp/panvas-protocol-${Date.now()}`;
  let peer: net.Socket | undefined;
  const received: { opcode: number; bytes: Buffer }[] = [];
  const server = net.createServer(socket => {
    peer = socket;
    let buffer = Buffer.alloc(0);
    socket.on('data', chunk => {
      buffer = Buffer.concat([buffer, chunk]);
      while (buffer.length >= 8 && buffer.length >= 8 + buffer.readUInt32LE(4)) {
        const length = buffer.readUInt32LE(4);
        received.push({ opcode: buffer.readUInt32LE(0), bytes: Buffer.from(buffer.subarray(8, 8 + length)) });
        buffer = buffer.subarray(8 + length);
      }
    });
  });
  await new Promise<void>(resolve => server.listen(pipe, resolve));
  const service = new DiscordPresenceService({ customPipePath: pipe });
  try {
    service.start();
    await waitFor(() => received.length === 1);
    assert.equal(received[0].opcode, 0);
    assert.equal(received[0].bytes.toString(), '{"v":1,"client_id":"1546879865997758576"}');
    service.sendActivity();
    peer!.write(frame(1, { cmd: 'DISPATCH', evt: 'OTHER' }));
    await new Promise(resolve => setTimeout(resolve, 30));
    assert.equal(received.length, 1);
    assert.equal(service.getStatus().ready, false);
    const ready = frame(1, { cmd: 'DISPATCH', evt: 'READY' });
    peer!.write(ready.subarray(0, 5));
    await new Promise(resolve => setTimeout(resolve, 20));
    assert.equal(service.getStatus().ready, false);
    peer!.write(ready.subarray(5));
    await waitFor(() => received.length === 2);
    const activity = JSON.parse(received[1].bytes.toString());
    assert.equal(validateActivityPrivacy(activity.args.activity), true);
    assert.equal(service.getStatus().activityConfirmed, false);
    peer!.write(frame(1, { cmd: 'SET_ACTIVITY', nonce: 'wrong' }));
    await new Promise(resolve => setTimeout(resolve, 20));
    assert.equal(service.getStatus().activityConfirmed, false);
    const ping = Buffer.from([0, 255, 12, 34]);
    peer!.write(Buffer.concat([frame(1, { cmd: 'SET_ACTIVITY', nonce: activity.nonce }), frame(3, ping), ready]));
    await waitFor(() => service.getStatus().activityConfirmed && received.length === 3);
    assert.equal(received[2].opcode, 4);
    assert.deepEqual(received[2].bytes, ping);
  } finally { service.destroy(); peer?.destroy(); server.close(); }
});

for (const payload of [Buffer.from('{"code":4000,"message":"Invalid Client ID","extra":"full payload"}'), Buffer.from('not JSON')]) {
  test(`CLOSE logs exact payload and backs off: ${payload.toString()}`, async () => {
    const pipe = process.platform === 'win32' ? `\\\\?\\pipe\\panvas-close-${Date.now()}` : `/tmp/panvas-close-${Date.now()}`;
    const logs: string[] = [];
    let connections = 0;
    const server = net.createServer(socket => { connections++; socket.once('data', () => socket.end(frame(2, payload))); });
    await new Promise<void>(resolve => server.listen(pipe, resolve));
    const service = new DiscordPresenceService({ customPipePath: pipe, debugLogs: true, logger: (_level, message) => logs.push(message) });
    try {
      service.start();
      await waitFor(() => logs.some(message => message.includes('Discord CLOSE')));
      assert.ok(logs.some(message => message.includes(payload.toString())));
      assert.ok(logs.some(message => message.includes('Retrying Discord IPC in 20s')));
      assert.equal(service.getStatus().ready, false);
      assert.equal(service.getStatus().activityConfirmed, false);
      assert.equal(service.getStatus().reconnectTimerActive, true);
      await new Promise(resolve => setTimeout(resolve, 60));
      assert.equal(connections, 1);
    } finally { service.destroy(); server.close(); }
  });
}

test('matching activity responses log full data and errors never acknowledge presence', () => {
  const logs: string[] = [];
  const service = new DiscordPresenceService({ debugLogs: true, logger: (_level, message) => logs.push(message) });
  const protocol = service as unknown as { activityNonce: string | null; handleFrame(opcode: number, bytes: Buffer): void };
  try {
    for (const evt of ['ERROR', 'UNEXPECTED', null]) {
      protocol.activityNonce = 'expected-nonce';
      const response = { cmd: 'SET_ACTIVITY', evt, data: { code: 4006, message: 'Exact rejection', nested: { retained: true } }, nonce: 'wrong-nonce' };
      protocol.handleFrame(1, Buffer.from(JSON.stringify(response)));
      assert.equal(service.getStatus().activityConfirmed, false);
      response.nonce = 'expected-nonce';
      protocol.handleFrame(1, Buffer.from(JSON.stringify(response)));
      assert.ok(logs.some(message => message.includes(JSON.stringify(response))));
      assert.equal(service.getStatus().activityConfirmed, evt === null);
    }
    assert.ok(logs.some(message => message.includes('code=4006, message="Exact rejection"')));
  } finally { service.destroy(); }
});
