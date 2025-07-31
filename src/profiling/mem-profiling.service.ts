import { Injectable, Logger } from '@nestjs/common';
import * as v8 from 'v8';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class MemoryProfilingService {
  private readonly logger = new Logger(MemoryProfilingService.name);

  /**
   * Get current memory usage statistics
   */
  getMemoryUsage() {
    const memUsage = process.memoryUsage();
    const heapStats = v8.getHeapStatistics();

    return {
      rss: Math.round(memUsage.rss / 1024 / 1024),
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
      external: Math.round(memUsage.external / 1024 / 1024),
      arrayBuffers: Math.round(memUsage.arrayBuffers / 1024 / 1024),
      heapSizeLimit: Math.round(heapStats.heap_size_limit / 1024 / 1024),
      totalHeapSize: Math.round(heapStats.total_heap_size / 1024 / 1024),
      usedHeapSize: Math.round(heapStats.used_heap_size / 1024 / 1024),
      mallocedMemory: Math.round(heapStats.malloced_memory / 1024 / 1024),
    };
  }

  /**
   * Take a heap snapshot and save to file
   */
  takeHeapSnapshot(filename?: string): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const snapshotPath = path.join(
      process.cwd(),
      'heap-snapshots',
      filename || `heap-${timestamp}.heapsnapshot`,
    );

    const dir = path.dirname(snapshotPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const snapshot = v8.getHeapSnapshot();
    const fileStream = fs.createWriteStream(snapshotPath);

    snapshot.pipe(fileStream);

    this.logger.log(`Heap snapshot saved to: ${snapshotPath}`);
    return snapshotPath;
  }

  /**
   * Start CPU profiling
   */
  startCPUProfiling() {
    const inspector = require('inspector');
    const session = new inspector.Session();
    session.connect();

    session.post('Profiler.enable', () => {
      session.post('Profiler.start', () => {
        this.logger.log('CPU profiling started');
      });
    });

    return session;
  }

  /**
   * Stop CPU profiling and save to file
   */
  async stopCPUProfiling(session: any, filename?: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const profilePath = path.join(
        process.cwd(),
        'cpu-profiles',
        filename || `cpu-profile-${timestamp}.cpuprofile`,
      );

      const dir = path.dirname(profilePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      session.post('Profiler.stop', (err: any, { profile }: any) => {
        if (err) {
          reject(err);
          return;
        }

        fs.writeFileSync(profilePath, JSON.stringify(profile));
        session.disconnect();

        this.logger.log(`CPU profile saved to: ${profilePath}`);
        resolve(profilePath);
      });
    });
  }

  /**
   * Monitor memory usage and log warnings
   */
  startMemoryMonitoring(intervalMs: number = 30000, threshold: number = 80) {
    setInterval(() => {
      const memUsage = this.getMemoryUsage();
      const usagePercent = (memUsage.heapUsed / memUsage.heapSizeLimit) * 100;

      if (usagePercent > threshold) {
        this.logger.warn(
          `High memory usage detected: ${usagePercent.toFixed(2)}%`,
          {
            memUsage,
            timestamp: new Date().toISOString(),
          },
        );

        if (usagePercent > 90) {
          this.takeHeapSnapshot(`high-memory-${Date.now()}.heapsnapshot`);
        }
      }
    }, intervalMs);
  }

  /**
   * Force garbage collection (requires --expose-gc flag)
   */
  forceGarbageCollection() {
    if (global.gc) {
      const before = this.getMemoryUsage();
      global.gc();
      const after = this.getMemoryUsage();

      this.logger.log('Garbage collection completed', {
        memoryFreed: before.heapUsed - after.heapUsed,
        before: before.heapUsed,
        after: after.heapUsed,
      });

      return { before, after };
    } else {
      this.logger.warn(
        'Garbage collection not available. Start with --expose-gc flag',
      );
      return null;
    }
  }
}
