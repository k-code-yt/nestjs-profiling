import { Injectable, Logger } from '@nestjs/common';
import { Response } from 'express';
import { Server, Socket } from 'socket.io';
import * as zlib from 'zlib';
import { generateNewsletterJSON } from './helper';

interface ConnectionInfo {
  type: 'sse' | 'ws';
  connection: Response | Socket;
  id: string;
}

@Injectable()
export class NewsletterBroadcastService {
  private readonly logger = new Logger('NewsletterBroadcastService');
  private connections = new Map<string, ConnectionInfo>();
  private compressionCache = new Map<string, Buffer>();
  private lastMessageId = 0;
  private newsInterval: NodeJS.Timeout | null;
  private isBroadcasting = false;
  private readonly CONNECTION_THRESHOLD = 1;
  private readonly BROADCAST_INTERVAL = 1000; // 5 seconds
  private testType: 'ws' | 'sse';
  private enableCompression: boolean;
  private wsServer: Server;

  addSSEConnection(
    connectionId: string,
    res: Response,
    enableCompression: boolean,
  ): void {
    if (!this.testType) this.testType = 'sse';
    if (!this.enableCompression) this.enableCompression = enableCompression;
    this.connections.set(connectionId, {
      type: 'sse',
      connection: res,
      id: connectionId,
    });

    this.checkBroadcastThreshold();

    res.on('close', () => {
      this.removeConnection(connectionId);
    });

    res.on('error', (err) => {
      this.logger.error(`SSE connection error for ${connectionId}:`, err);
      this.removeConnection(connectionId);
    });
  }

  addWSConnection(
    connectionId: string,
    socket: Socket,
    enableCompression: boolean,
    server: Server,
  ): void {
    if (!this.testType) this.testType = 'ws';
    if (!this.enableCompression) this.enableCompression = enableCompression;
    if (!this.wsServer) this.wsServer = server;
    this.connections.set(connectionId, {
      type: 'ws',
      connection: socket,
      id: connectionId,
    });

    this.logger.debug(
      `WS connection added: ${connectionId}, total: ${this.connections.size}`,
    );

    this.checkBroadcastThreshold();

    socket.on('disconnect', () => {
      this.removeConnection(connectionId);
    });

    socket.on('error', (err) => {
      this.logger.error(`WS connection error for ${connectionId}:`, err);
      this.removeConnection(connectionId);
    });
  }

  public removeConnection(connectionId: string): void {
    this.connections.delete(connectionId);
    this.logger.debug(
      `Connection removed: ${connectionId}, remaining: ${this.connections.size}`,
    );
    this.checkBroadcastThreshold();
  }

  private checkBroadcastThreshold(): void {
    const connectionCount = this.connections.size;

    if (connectionCount >= this.CONNECTION_THRESHOLD && !this.isBroadcasting) {
      this.startNewsletterBroadcast();
    } else if (
      connectionCount < this.CONNECTION_THRESHOLD &&
      this.isBroadcasting
    ) {
      this.stopNewsletterBroadcast();
    }
  }

  private startNewsletterBroadcast(): void {
    this.logger.debug(`isBroadcast = ${this.isBroadcasting}`);
    if (this.isBroadcasting) return;

    this.isBroadcasting = true;
    this.logger.log(
      `Starting newsletter broadcast with ${this.connections.size} connections`,
    );
    this.logger.debug(`this.enableCompression = ${this.enableCompression}`);

    this.newsInterval = setInterval(async () => {
      const newsletterData = {
        type: 'newsletter',
        content: generateNewsletterJSON(),
        timestamp: new Date().toISOString(),
        messageId: ++this.lastMessageId,
      };
      if (this.testType === 'sse') {
        await this.broadcastToSSE(newsletterData);
      } else {
        await this.broadcastToWebSockets(newsletterData);
      }
    }, this.BROADCAST_INTERVAL);
  }

  private stopNewsletterBroadcast(): void {
    if (!this.isBroadcasting) return;

    this.isBroadcasting = false;
    this.logger.log(
      `Stopping newsletter broadcast, connections: ${this.connections.size}`,
    );

    if (this.newsInterval) {
      clearInterval(this.newsInterval);
      this.newsInterval = null;
    }
  }

  private async broadcastToWebSockets(data: any): Promise<void> {
    const wsConnections = Array.from(this.connections.values()).filter(
      (conn) => conn.type === 'ws',
    );
    const messageData = JSON.stringify(data);
    const compressedData = await this.compressData(messageData);
    if (wsConnections.length === 0) return;

    this.wsServer.emit('message', {
      data: compressedData,
      type: 'message',
    //   compressed: this.enableCompression,
      totalWSConnections: wsConnections.length,
    });
  }

  private async broadcastToSSE(data: any): Promise<void> {
    const sseConnections = Array.from(this.connections.values()).filter(
      (conn) => conn.type === 'sse',
    );

    if (sseConnections.length === 0) return;

    // CREATE AND COMPRESS SSE MESSAGE ONCE
    const messageData = JSON.stringify(data);
    const sseData = `event: newsletter\nid: ${data.messageId}\ndata: ${messageData}\n\n`;
    const compressedSSE = await this.compressData(sseData);
    const payload = this.enableCompression ? compressedSSE : sseData;
    // SEND TO ALL SSE CONNECTIONS
    const deadConnections: string[] = [];
    for (const connInfo of sseConnections) {
      try {
        (connInfo.connection as Response).write(payload);
      } catch (err) {
        deadConnections.push(connInfo.id);
      }
    }

    deadConnections.forEach((id) => this.removeConnection(id));
    // this.logger.debug(
    //   `Broadcasted ${payload.length}B to ${sseConnections.length} SSE clients`,
    // );
  }

  private async compressData(data: string): Promise<Buffer> {
    const cacheKey = this.createCacheKey(data);
    let compressed = this.compressionCache.get(cacheKey);

    if (!compressed) {
      compressed = await new Promise<Buffer>((resolve, reject) => {
        const chunks: Buffer[] = [];

        const brotliStream = zlib.createBrotliCompress({
          params: {
            [zlib.constants.BROTLI_PARAM_MODE]: zlib.constants.BROTLI_MODE_TEXT,
            [zlib.constants.BROTLI_PARAM_QUALITY]: 4, // Balanced quality/speed
            [zlib.constants.BROTLI_PARAM_LGWIN]: 16,
          },
        });

        brotliStream.on('data', (chunk) => chunks.push(chunk));
        brotliStream.on('end', () => {
          brotliStream.destroy();
          resolve(Buffer.concat(chunks));
        });
        brotliStream.on('error', (err) => {
          brotliStream.destroy();
          reject(err);
        });

        brotliStream.write(data);
        brotliStream.end();
      });

      // Cache management
      if (this.compressionCache.size < 50) {
        this.compressionCache.set(cacheKey, compressed);

        // Auto-expire cache entries
        setTimeout(() => {
          this.compressionCache.delete(cacheKey);
        }, 30000);
      }
    }

    return compressed;
  }

  private createCacheKey(data: string): string {
    return Buffer.from(data).toString('base64').slice(0, 32);
  }

  getStats() {
    const connectionsByType = {
      sse: 0,
      ws: 0,
    };

    for (const connInfo of this.connections.values()) {
      connectionsByType[connInfo.type]++;
    }

    return {
      totalConnections: this.connections.size,
      connectionsByType,
      isBroadcasting: this.isBroadcasting,
      cacheSize: this.compressionCache.size,
      lastMessageId: this.lastMessageId,
      thresholdMet: this.connections.size >= this.CONNECTION_THRESHOLD,
    };
  }

  destroy(): void {
    this.stopNewsletterBroadcast();
    this.connections.clear();
    this.compressionCache.clear();
  }
}
