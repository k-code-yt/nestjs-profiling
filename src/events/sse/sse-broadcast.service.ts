import { Injectable, Logger } from '@nestjs/common';
import { Response } from 'express';
import * as zlib from 'zlib';
import { generateLargePayload } from '../helper';
import { serialize } from 'v8';

@Injectable()
export class SSEBroadcastService {
  private readonly logger = new Logger('SSEBroadcastService');
  private connections = new Map<string, Response>();
  private compressionCache = new Map<string, Buffer>();
  private lastMessageId = 0;
  private newsInterval: NodeJS.Timeout;
  private isBroadcasting = false;

  addConnection(connectionId: string, res: Response): void {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader(
      'Cache-Control',
      'private, no-cache, no-store, must-revalidate, max-age=0, no-transform',
    );
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    this.connections.set(connectionId, res);
    this.startNewsletterBroadcast();

    this.logger.debug(
      `Connection added: ${connectionId}, total: ${this.connections.size}`,
    );

    res.on('close', () => {
      this.removeConnection(connectionId);
    });

    res.on('error', (err) => {
      this.logger.error(`Connection error for ${connectionId}:`, err);
      this.removeConnection(connectionId);
    });
  }

  removeConnection(connectionId: string): void {
    this.connections.delete(connectionId);
    if (this.connections.size === 0) {
      this.isBroadcasting = false;
    }
    this.logger.debug(
      `Connection removed: ${connectionId}, remaining: ${this.connections.size}`,
    );
  }

  private startNewsletterBroadcast() {
    return;
    if (this.isBroadcasting) return;
    this.isBroadcasting = true;

    this.newsInterval = setInterval(async () => {
      const newsletterData = {
        type: 'broadcast',
        headline: `Breaking News ${Date.now()}`,
        // content: generateNewsContent(),
        content: generateLargePayload(),
        timestamp: new Date().toISOString(),
        edition: Math.floor(Date.now() / 1000),
      };

      await this.broadcastMessage(newsletterData);
    }, 5000);
  }

  async broadcastMessage(data: any): Promise<void> {
    const messageId = ++this.lastMessageId;
    const sseData = `event: broadcast\nid: ${messageId}\ndata: ${JSON.stringify(data)}\n\n`;

    const cacheKey = this.createCacheKey(sseData);
    let compressed = this.compressionCache.get(cacheKey);

    if (!compressed) {
      compressed = await this.compressData(sseData);

      if (this.compressionCache.size < 100) {
        this.compressionCache.set(cacheKey, compressed);

        setTimeout(() => {
          this.compressionCache.delete(cacheKey);
        }, 30000);
      }
    }

    const deadConnections: string[] = [];

    for (const [connectionId, res] of this.connections) {
      try {
        res.write(compressed);
      } catch (err) {
        this.logger.error(`Failed to send to ${connectionId}:`, err);
        deadConnections.push(connectionId);
      }
    }

    deadConnections.forEach((id) => this.removeConnection(id));

    this.logger.debug(
      `Broadcasted ${compressed.length} bytes to ${this.connections.size} connections`,
    );
  }

  private async compressData(data: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];

      const brotliStream = zlib.createBrotliCompress({
        params: {
          [zlib.constants.BROTLI_PARAM_MODE]: zlib.constants.BROTLI_MODE_TEXT,
          [zlib.constants.BROTLI_PARAM_QUALITY]: 1,
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
  }

  private createCacheKey(data: string): string {
    return Buffer.from(data).toString('base64').slice(0, 32);
  }

  getStats() {
    return {
      activeConnections: this.connections.size,
      cacheSize: this.compressionCache.size,
      lastMessageId: this.lastMessageId,
    };
  }

  destroy() {
    this.connections.clear();
    this.compressionCache.clear();
  }
}
