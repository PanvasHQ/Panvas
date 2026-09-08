// ============================================
// Panvas — Discord Rich Presence (Desktop/Electron V1)
// ============================================
// Lightweight, standalone local IPC client for Discord Rich Presence.
// Uses Discord's local IPC named pipe / domain socket protocol.
// Does NOT require bot tokens, OAuth, webhooks, or external network servers.
// Privacy rule: Advertises only that Panvas is in use. Never exposes
// workspaces, notebooks, pages, PDF names, titles, or user content.

import net from 'node:net';
import path from 'node:path';

export const DISCORD_APP_ID = '15468798695997758576';
export const DISCORD_ASSET_KEY = 'panvas-logo_1';
export const DEFAULT_RECONNECT_INTERVAL_MS = 20_000;

export interface DiscordActivity {
  details: string;
  assets: {
    large_image: string;
    large_text: string;
  };
}

export interface DiscordRpcOptions {
  clientId?: string;
  assetKey?: string;
  reconnectIntervalMs?: number;
  customPipePath?: string;
}

/**
 * Builds the canonical, privacy-safe Panvas Rich Presence payload.
 * Absolutely no workspace, notebook, page, document, or user data is included.
 */
export function buildPanvasActivity(assetKey: string = DISCORD_ASSET_KEY): DiscordActivity {
  return {
    details: 'Using Panvas',
    assets: {
      large_image: assetKey,
      large_text: 'Panvas',
    },
  };
}

/**
 * Validates that an activity payload complies with the strict Panvas privacy rule:
 * only 'Using Panvas' details and the approved Panvas logo assets are allowed.
 */
export function validateActivityPrivacy(activity: unknown): boolean {
  if (!activity || typeof activity !== 'object') return false;
  const act = activity as Record<string, unknown>;
  if (act.details !== 'Using Panvas') return false;

  const assets = act.assets as Record<string, unknown> | undefined;
  if (!assets || assets.large_image !== DISCORD_ASSET_KEY || assets.large_text !== 'Panvas') {
    return false;
  }

  const allowedTopLevel = new Set(['details', 'assets']);
  for (const key of Object.keys(act)) {
    if (!allowedTopLevel.has(key)) return false;
  }

  const allowedAssetKeys = new Set(['large_image', 'large_text']);
  for (const key of Object.keys(assets)) {
    if (!allowedAssetKeys.has(key)) return false;
  }

  return true;
}

export class DiscordPresenceService {
  private clientId: string;
  private assetKey: string;
  private reconnectIntervalMs: number;
  private customPipePath?: string;

  private socket: net.Socket | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private isConnected = false;
  private isConnecting = false;
  private isDestroyed = false;
  private buffer: Buffer = Buffer.alloc(0);

  constructor(options: DiscordRpcOptions = {}) {
    this.clientId = options.clientId ?? DISCORD_APP_ID;
    this.assetKey = options.assetKey ?? DISCORD_ASSET_KEY;
    this.reconnectIntervalMs = options.reconnectIntervalMs ?? DEFAULT_RECONNECT_INTERVAL_MS;
    this.customPipePath = options.customPipePath;
  }

  /**
   * Starts the presence service. Attempts connection immediately;
   * if Discord is unavailable, schedules polite background retries.
   */
  public start(): void {
    if (this.isDestroyed || this.isConnected || this.isConnecting) return;
    void this.tryConnect();
  }

  /**
   * Returns whether the service is actively connected to a local Discord client.
   */
  public isConnectedToDiscord(): boolean {
    return this.isConnected && this.socket !== null && !this.socket.destroyed;
  }

  public getStatus() {
    return {
      connected: this.isConnectedToDiscord(),
      destroyed: this.isDestroyed,
      connecting: this.isConnecting,
      reconnectTimerActive: this.reconnectTimer !== null,
    };
  }

  private getIpcPipePath(id: number): string {
    if (process.platform === 'win32') {
      return `\\\\?\\pipe\\discord-ipc-${id}`;
    }
    const env = process.env;
    const prefix = env.XDG_RUNTIME_DIR || env.TMPDIR || env.TMP || env.TEMP || '/tmp';
    return path.join(prefix, `discord-ipc-${id}`);
  }

  private connectToPath(pipePath: string): Promise<net.Socket | null> {
    return new Promise((resolve) => {
      let resolved = false;
      let socket: net.Socket;

      try {
        socket = net.createConnection(pipePath);
      } catch {
        return resolve(null);
      }

      const onConnect = () => {
        if (resolved) return;
        resolved = true;
        socket.removeListener('error', onError);
        resolve(socket);
      };

      const onError = () => {
        if (resolved) return;
        resolved = true;
        socket.removeListener('connect', onConnect);
        try {
          socket.destroy();
        } catch {
          // Ignore
        }
        resolve(null);
      };

      socket.once('connect', onConnect);
      socket.once('error', onError);

      socket.setTimeout(2500, () => {
        if (!resolved) {
          resolved = true;
          try {
            socket.destroy();
          } catch {
            // Ignore
          }
          resolve(null);
        }
      });
    });
  }

  private async findAndConnectPipe(): Promise<net.Socket | null> {
    if (this.customPipePath) {
      return this.connectToPath(this.customPipePath);
    }
    for (let i = 0; i < 10; i++) {
      if (this.isDestroyed) return null;
      const pipePath = this.getIpcPipePath(i);
      const socket = await this.connectToPath(pipePath);
      if (socket) {
        return socket;
      }
    }
    return null;
  }

  private async tryConnect(): Promise<void> {
    if (this.isDestroyed || this.isConnected || this.isConnecting) return;
    this.isConnecting = true;

    try {
      const socket = await this.findAndConnectPipe();
      if (socket && !this.isDestroyed) {
        this.setupConnectedSocket(socket);
      } else if (!this.isDestroyed) {
        this.scheduleReconnect();
      }
    } catch {
      if (!this.isDestroyed) {
        this.scheduleReconnect();
      }
    } finally {
      this.isConnecting = false;
    }
  }

  private setupConnectedSocket(socket: net.Socket): void {
    this.socket = socket;
    this.isConnected = true;
    this.buffer = Buffer.alloc(0);

    socket.on('data', (chunk: Buffer) => {
      this.buffer = Buffer.concat([this.buffer, chunk]);
      while (this.buffer.length >= 8) {
        const opcode = this.buffer.readUInt32LE(0);
        const length = this.buffer.readUInt32LE(4);
        if (this.buffer.length < 8 + length) {
          break; // Await remaining frame bytes
        }
        const payloadBuf = this.buffer.subarray(8, 8 + length);
        this.buffer = this.buffer.subarray(8 + length);
        this.handleFrame(opcode, payloadBuf);
      }
    });

    socket.on('error', () => {
      this.handleSocketTermination();
    });

    socket.on('close', () => {
      this.handleSocketTermination();
    });

    // Send initial handshake (opcode 0)
    this.sendHandshake();
  }

  private handleSocketTermination(): void {
    if (this.socket) {
      try {
        this.socket.destroy();
      } catch {
        // Ignore
      }
      this.socket = null;
    }
    this.isConnected = false;
    this.buffer = Buffer.alloc(0);

    if (!this.isDestroyed) {
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (this.isDestroyed || this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.tryConnect();
    }, this.reconnectIntervalMs);

    // Unref timer so it never holds Node/Electron process open
    if (typeof this.reconnectTimer.unref === 'function') {
      this.reconnectTimer.unref();
    }
  }

  private sendFrame(opcode: number, payload: unknown): void {
    if (!this.socket || this.socket.destroyed || !this.socket.writable) return;
    try {
      const payloadBuf = Buffer.isBuffer(payload)
        ? payload
        : Buffer.from(JSON.stringify(payload), 'utf8');
      const headerBuf = Buffer.alloc(8);
      headerBuf.writeUInt32LE(opcode, 0);
      headerBuf.writeUInt32LE(payloadBuf.length, 4);
      this.socket.write(Buffer.concat([headerBuf, payloadBuf]));
    } catch {
      // Handled via socket error/close
    }
  }

  private sendHandshake(): void {
    this.sendFrame(0 /* HANDSHAKE */, {
      v: 1,
      client_id: this.clientId,
    });
  }

  public sendActivity(): void {
    if (!this.socket || this.socket.destroyed || !this.socket.writable) return;
    this.sendFrame(1 /* FRAME */, {
      cmd: 'SET_ACTIVITY',
      args: {
        pid: process.pid,
        activity: buildPanvasActivity(this.assetKey),
      },
      nonce: `panvas-${Date.now()}`,
    });
  }

  public clearActivity(): void {
    if (!this.socket || this.socket.destroyed || !this.socket.writable) return;
    this.sendFrame(1 /* FRAME */, {
      cmd: 'SET_ACTIVITY',
      args: {
        pid: process.pid,
        activity: null,
      },
      nonce: `panvas-clear-${Date.now()}`,
    });
  }

  private handleFrame(opcode: number, payloadBuf: Buffer): void {
    if (opcode === 1 /* FRAME */) {
      try {
        const data = JSON.parse(payloadBuf.toString('utf8'));
        if (data.evt === 'READY' || data.cmd === 'DISPATCH') {
          this.sendActivity();
        }
      } catch {
        // Ignore parse errors from unexpected frames
      }
    } else if (opcode === 2 /* CLOSE */) {
      // Discord rejected connection (e.g. invalid app id) or closed socket
      this.handleSocketTermination();
    } else if (opcode === 3 /* PING */) {
      this.sendFrame(4 /* PONG */, payloadBuf);
    }
  }

  /**
   * Destroys the presence service, clears activity if connected,
   * cancels all reconnect timers, and cleans up sockets.
   */
  public destroy(): void {
    this.isDestroyed = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.socket) {
      try {
        if (this.isConnected && !this.socket.destroyed && this.socket.writable) {
          this.clearActivity();
        }
      } catch {
        // Ignore
      }
      try {
        this.socket.destroy();
      } catch {
        // Ignore
      }
      this.socket = null;
    }
    this.isConnected = false;
    this.isConnecting = false;
  }
}

// Global active instance for Electron lifecycle management
let activeService: DiscordPresenceService | null = null;

export function initDiscordRpc(options?: DiscordRpcOptions): DiscordPresenceService {
  if (activeService) {
    return activeService;
  }
  activeService = new DiscordPresenceService(options);
  activeService.start();
  return activeService;
}

export function destroyDiscordRpc(): void {
  if (activeService) {
    activeService.destroy();
    activeService = null;
  }
}

export function getDiscordRpcService(): DiscordPresenceService | null {
  return activeService;
}

