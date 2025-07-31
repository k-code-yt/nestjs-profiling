import { Controller, Post, Get, Query, Body } from '@nestjs/common';

const memoryStressStorage = new Map<string, any>();

@Controller('stress')
export class MemoryStressController {
  private memoryLeaks: any[] = [];
  private intervalRefs: NodeJS.Timeout[] = [];

  /**
   * Allocate external memory
   */
  @Post('allocate-memory')
  allocateMemory(
    @Query('sizeMB') sizeMB: string = '50',
    @Query('chunks') chunks: string = '1',
  ) {
    const sizeInMB = parseInt(sizeMB, 10);
    const numChunks = parseInt(chunks, 10);
    const allocated: Buffer[] = [];

    try {
      for (let i = 0; i < numChunks; i++) {
        const buffer = Buffer.alloc(sizeInMB * 1024 * 1024, 'A');
        allocated.push(buffer);
        memoryStressStorage.set(`chunk_${Date.now()}_${i}`, buffer);
      }

      return {
        status: 'success',
        message: `Allocated ${sizeInMB * numChunks}MB in ${numChunks} chunks`,
        totalAllocated: sizeInMB * numChunks,
        memoryUsage: this.getMemoryUsage(),
        storageSize: memoryStressStorage.size,
      };
    } catch (error) {
      return {
        status: 'error',
        message: 'Failed to allocate memory',
        error: error.message,
        memoryUsage: this.getMemoryUsage(),
      };
    }
  }

  /**
   * Old memory(long lived) -> cannot be cleaned by GC(circular deps)
   */
  @Post('create-memory-leak')
  createMemoryLeak(@Query('intervalMs') intervalMs: string = '1000') {
    const interval = parseInt(intervalMs, 10);

    const leakInterval = setInterval(() => {
      const leak = {
        id: Date.now(),
        data: new Array(10000).fill('memory leak data'),
        timestamp: new Date(),
        reference: this.memoryLeaks, // creates circular dependency
      };

      this.memoryLeaks.push(leak); // creates circular dependency

      memoryStressStorage.set(`leak_${leak.id}`, leak);
    }, interval);

    this.intervalRefs.push(leakInterval);

    return {
      status: 'success',
      message: `Memory leak created with ${interval}ms interval`,
      activeLeaks: this.intervalRefs.length,
      memoryUsage: this.getMemoryUsage(),
    };
  }

  /**
   * Initally NEW space, then will move to OLD memory due to largeArray.push(obj)
   */
  @Post('stress-heap')
  stressHeap(
    @Query('iterations') iterations: string = '1000000',
    @Query('objectSize') objectSize: string = '100',
  ) {
    const numIterations = parseInt(iterations, 10);
    const objSize = parseInt(objectSize, 10);
    const startTime = Date.now();

    try {
      const largeArray: any = [];

      for (let i = 0; i < numIterations; i++) {
        const obj = {
          id: i,
          data: new Array(objSize).fill(`stress_data_${i}`),
          nested: {
            level1: new Array(objSize / 2).fill(`nested_${i}`),
            level2: {
              deep: new Array(objSize / 4).fill(`deep_${i}`),
            },
          },
        };
        largeArray.push(obj);

        if (i % 1000 === 0) {
          memoryStressStorage.set(`stress_${i}`, obj);
        }
      }

      const duration = Date.now() - startTime;

      return {
        status: 'success',
        message: `Created ${numIterations} objects`,
        duration,
        objectsPerSecond: Math.round(numIterations / (duration / 1000)),
        memoryUsage: this.getMemoryUsage(),
        permanentlyStored: Math.floor(numIterations / 1000),
      };
    } catch (error) {
      return {
        status: 'error',
        message: 'Heap stress test failed',
        error: error.message,
        memoryUsage: this.getMemoryUsage(),
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Initally NEW space, then might move to OLD memory
   * depending on depth on how much data is in accumulator
   * i.e. if cannot be cleared by minor GC
   */
  @Post('recursive-function')
  recursiveFunction(@Query('depth') depth: string = '10000') {
    const maxDepth = parseInt(depth, 10);

    const recursiveMemoryEater = (
      currentDepth: number,
      accumulator: any[] = [],
    ): any => {
      if (currentDepth >= maxDepth) {
        return accumulator;
      }

      const levelData = new Array(1000).fill(`recursion_level_${currentDepth}`);
      accumulator.push(levelData);

      return recursiveMemoryEater(currentDepth + 1, accumulator);
    };

    try {
      const result = recursiveMemoryEater(0);

      memoryStressStorage.set(`recursive_${Date.now()}`, result);

      return {
        status: 'success',
        message: `Recursive function completed to depth ${maxDepth}`,
        resultSize: result.length,
        memoryUsage: this.getMemoryUsage(),
      };
    } catch (error) {
      return {
        status: 'error',
        message: 'Recursive function failed',
        error: error.message,
        memoryUsage: this.getMemoryUsage(),
      };
    }
  }

  /**
   * Initally NEW space, then might move to OLD memory
   * And due to Buffer.alloc also external
   */
  @Post('simulate-real-usage')
  simulateRealUsage(@Query('users') users: string = '1000') {
    const numUsers = parseInt(users, 10);

    for (let i = 0; i < numUsers; i++) {
      const userData = {
        userId: i,
        sessionData: new Array(100).fill(`session_data_${i}`), // ← NEW initially
        cachedQueries: new Array(50).fill({
          query: `SELECT * FROM users WHERE id = ${i}`,
          result: new Array(20).fill(`cached_result_${i}`),
          timestamp: Date.now(),
        }), // ← NEW initially
        temporaryFiles: new Array(10).fill(
          Buffer.alloc(1024, 'temp_file_data'), // External
        ),
        connections: new Array(5).fill({
          id: `conn_${i}`,
          data: new Array(30).fill(`connection_data_${i}`),
        }), // ← NEW initially
      };

      memoryStressStorage.set(`user_${i}`, userData); // OLD
    }

    return {
      status: 'success',
      message: `Simulated ${numUsers} user sessions`,
      totalUsers: numUsers,
      memoryUsage: this.getMemoryUsage(),
      storageSize: memoryStressStorage.size,
    };
  }

  /**
   * Similate CPU load
   */
  @Post('cpu-intensive')
  cpuIntensiveTask(
    @Query('duration') duration: string = '5000',
    @Query('complexity') complexity: string = 'medium',
  ) {
    const durationMs = parseInt(duration, 10);
    const startTime = Date.now();
    let operations = 0;

    try {
      switch (complexity) {
        case 'light':
          operations = this.lightCpuWork(durationMs);
          break;
        case 'medium':
          operations = this.mediumCpuWork(durationMs);
          break;
        case 'heavy':
          operations = this.heavyCpuWork(durationMs);
          break;
        case 'blocking':
          operations = this.blockingCpuWork(durationMs);
          break;
        default:
          operations = this.mediumCpuWork(durationMs);
      }

      const actualDuration = Date.now() - startTime;

      return {
        status: 'success',
        message: `CPU intensive task completed`,
        complexity,
        requestedDuration: durationMs,
        actualDuration,
        operations,
        operationsPerSecond: Math.round(operations / (actualDuration / 1000)),
        memoryUsage: this.getMemoryUsage(),
      };
    } catch (error) {
      return {
        status: 'error',
        message: 'CPU task failed',
        error: error.message,
        duration: Date.now() - startTime,
        memoryUsage: this.getMemoryUsage(),
      };
    }
  }

  @Post('clear-memory')
  clearMemory(@Query('type') type: string = 'all') {
    let cleared = 0;

    switch (type) {
      case 'leaks':
        this.intervalRefs.forEach((ref) => clearInterval(ref));
        this.intervalRefs = [];
        this.memoryLeaks = [];
        cleared = 1;
        break;

      case 'storage':
        cleared = memoryStressStorage.size;
        memoryStressStorage.clear();
        break;

      case 'all':
      default:
        this.intervalRefs.forEach((ref) => clearInterval(ref));
        this.intervalRefs = [];
        this.memoryLeaks = [];
        cleared = memoryStressStorage.size;
        memoryStressStorage.clear();
        break;
    }

    if (global.gc) {
      global.gc();
    }

    return {
      status: 'success',
      message: `Cleared ${type} memory`,
      itemsCleared: cleared,
      memoryUsage: this.getMemoryUsage(),
    };
  }

  @Get('status')
  getStressStatus() {
    return {
      status: 'success',
      data: {
        activeMemoryLeaks: this.intervalRefs.length,
        storedObjects: memoryStressStorage.size,
        memoryLeakArraySize: this.memoryLeaks.length,
        memoryUsage: this.getMemoryUsage(),
        storageKeys: Array.from(memoryStressStorage.keys()).slice(0, 10),
      },
    };
  }

  private getMemoryUsage() {
    const usage = process.memoryUsage();
    return {
      rss: Math.round(usage.rss / 1024 / 1024),
      heapUsed: Math.round(usage.heapUsed / 1024 / 1024),
      heapTotal: Math.round(usage.heapTotal / 1024 / 1024),
      external: Math.round(usage.external / 1024 / 1024),
    };
  }

  private lightCpuWork(durationMs: number): number {
    const endTime = Date.now() + durationMs;
    let operations = 0;

    while (Date.now() < endTime) {
      Math.sqrt(Math.random() * 1000);
      Math.sin(Math.random() * Math.PI);
      Math.cos(Math.random() * Math.PI);
      operations += 3;

      if (operations % 10000 === 0) {
      }
    }

    return operations;
  }

  private mediumCpuWork(durationMs: number): number {
    const endTime = Date.now() + durationMs;
    let operations = 0;

    while (Date.now() < endTime) {
      for (let i = 0; i < 100; i++) {
        Math.pow(Math.random() * 10, 3);
        Math.log(Math.random() * 1000 + 1);
        operations += 2;
      }

      let str = 'test-string-for-cpu-load';
      for (let i = 0; i < 50; i++) {
        str = str.split('').reverse().join('');
        operations++;
      }
    }

    return operations;
  }

  private heavyCpuWork(durationMs: number): number {
    const endTime = Date.now() + durationMs;
    let operations = 0;

    const factorial = (n: number): number =>
      n <= 1 ? 1 : n * factorial(n - 1);

    while (Date.now() < endTime) {
      for (let i = 0; i < 1000; i++) {
        const base = Math.random() * 100;
        Math.pow(base, Math.random() * 10);
        Math.exp(Math.random() * 5);
        factorial(Math.floor(Math.random() * 10));
        operations += 3;
      }

      let text = 'complex-string-manipulation-for-heavy-cpu-load';
      for (let i = 0; i < 100; i++) {
        text = text.replace(/[aeiou]/g, (match) => match.toUpperCase());
        text = Buffer.from(text).toString('base64');
        text = Buffer.from(text, 'base64').toString('utf8');
        operations += 3;
      }
    }

    return operations;
  }

  private blockingCpuWork(durationMs: number): number {
    const endTime = Date.now() + durationMs;
    let operations = 0;

    while (Date.now() < endTime) {
      for (let i = 0; i < 10000; i++) {
        for (let j = 0; j < 100; j++) {
          Math.pow(i + j, 2);
          operations++;
        }
      }
    }

    return operations;
  }
}
