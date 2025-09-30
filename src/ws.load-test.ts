/* eslint-disable @typescript-eslint/no-require-imports */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */

import { Socket } from 'socket.io';

/* eslint-disable @typescript-eslint/no-unsafe-call */
export const io = require('socket.io-client');
process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';

async function simulateWebSocketConnections(config?: {
  url: string;
  connectionCount: number;
  messagesPerMinute: number;
  durationSeconds: number;
}) {
  const {
    url = 'wss://monitoring.local/performance',
    connectionCount = 100,
    messagesPerMinute = 10,
    durationSeconds = 120,
  } = config || {};

  const stats = {
    connectionsEstablished: 0,
    messagesReceived: 0,
    errors: 0,
    startTime: Date.now(),
  };

  const connections: { socket: Socket; int: number | null }[] = [];
  const compressionTest = true;
  for (let i = 0; i < connectionCount; i++) {
    const socket = io(url, {
      transports: ['websocket'],
      secure: true,
      rejectUnauthorized: false,
      forceNew: true,
      // Enable compression for Socket.IO
      compression: compressionTest,
      perMessageDeflate: compressionTest
        ? {
            threshold: 1024,
            concurrencyLimit: 10,
            serverMaxWindowBits: 15,
            clientMaxWindowBits: 15,
          }
        : false,
      // Additional headers to request compression
      extraHeaders: compressionTest
        ? {
            'Accept-Encoding': 'gzip, deflate, br',
            'Sec-WebSocket-Extensions':
              'permessage-deflate; client_max_window_bits',
          }
        : {},
    });

    socket.on('connect', () => {
      stats.connectionsEstablished++;

      const wsConn = socket.io?.engine?.transport?.ws;
      if (compressionTest && wsConn) {
        if (
          wsConn.extensions?.includes('permessage-deflate') &&
          stats.connectionsEstablished === 1
        ) {
          console.log('Compression is working');
        }
      }

      if (stats.connectionsEstablished % 100 === 0) {
        console.log(
          `WS: ${stats.connectionsEstablished}/${connectionCount} connections established`,
        );
      }
    });

    socket.on('message', (data) => {
      stats.messagesReceived++;
      console.log(data);
      const compressedSize = data.length;
      socket.emit('report-compressed', {
        compressedSize,
        originalSize: data.originalSize,
      });
    });

    socket.on('error', () => {
      stats.errors++;
      socket?.disconnect();
    });

    connections.push({ socket, int: null });

    if (i % 50 === 0) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  await new Promise((resolve) => setTimeout(resolve, durationSeconds * 1000));

  connections.forEach(({ socket, int }) => {
    if (int) {
      clearInterval(int);
    }
    (socket as any).removeAllListeners();
    (socket as any).disconnect(true);
  });

  const totalTime = (Date.now() - stats.startTime) / 1000;
  return {
    protocol: 'WebSocket',
    connectionsEstablished: stats.connectionsEstablished,
    messagesReceived: stats.messagesReceived,
    messagesPerSecond: stats.messagesReceived / totalTime,
    errors: stats.errors,
    testDuration: totalTime,
    memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024,
  };
}

interface TestConfig {
  url: string;
  connectionCount: number;
  messagesPerMinute: number;
  durationSeconds: number;
}

function parseArgs(): TestConfig {
  const args = process.argv.slice(2);
  const config: TestConfig = {
    url: 'ws://localhost:3000/performance',
    connectionCount: 100,
    messagesPerMinute: 10,
    durationSeconds: 60,
  };

  for (let i = 0; i < args.length; i += 2) {
    const arg = args[i];
    const value = args[i + 1];

    switch (arg) {
      case '--url':
      case '-u':
        config.url = value;
        break;
      case '--connections':
      case '-c':
        config.connectionCount = parseInt(value, 10);
        break;
      case '--messages-per-minute':
      case '-m':
        config.messagesPerMinute = parseInt(value, 10);
        break;
      case '--duration':
      case '-d':
        config.durationSeconds = parseInt(value, 10);
        break;
      case '--help':
      case '-h':
        printUsage();
        process.exit(0);
        break;
      default:
        console.error(`Unknown argument: ${arg}`);
        printUsage();
        process.exit(1);
    }
  }

  return config;
}

function printUsage() {
  console.log(`
		Usage: node ws.load-test.js [options]

		Options:
		-u, --url <url>                    WS server URL (default: ws://localhost:3000)
		-c, --connections <number>         Number of concurrent connections (default: 100)
		-m, --messages-per-minute <number> Messages per minute per connection (default: 10)
		-d, --duration <seconds>           Test duration in seconds (default: 120)
		-h, --help                         Show this help message

		Examples:
		node ws.load-test.js --url ws://localhost:3000 --connections 50 --duration 60
		node ws.load-test.js -c 200 -m 20 -d 300
  `);
}

if (require.main === module) {
  console.log('---STARTING TEST');
  const config = parseArgs();
  console.log('---CONFIG----');
  console.log(config);
  console.log('-------------');
  simulateWebSocketConnections(config)
    .then((results) => {
      console.log('\n=== Load Test Results ===');
      console.log(JSON.stringify(results, null, 2));
    })
    .catch((error) => {
      console.error('Load test failed:', error);
      process.exit(1);
    });
}
