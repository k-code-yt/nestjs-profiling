export const io = require('socket.io-client');

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

  const connections = [];

  for (let i = 0; i < connectionCount; i++) {
    const socket = io(url, {
      transports: ['websocket'],
      forceNew: true,
    });

    socket.on('connect', () => {
      stats.connectionsEstablished++;
      if (stats.connectionsEstablished % 100 === 0) {
        console.log(
          `WS: ${stats.connectionsEstablished}/${connectionCount} connections established`,
        );
      }
    });

    socket.on('message', (data) => {
      stats.messagesReceived++;
    });

    socket.on('error', () => {
      stats.errors++;
      (socket as any)?.disconnect();
    });

    connections.push({ socket, int: null } as never);

    if (i % 50 === 0) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  await new Promise((resolve) => setTimeout(resolve, durationSeconds * 1000));

  connections.forEach(({ socket, interval }) => {
    clearInterval(interval);
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

simulateWebSocketConnections()
  .then((r) => console.log({ r }))
  .catch((e) => console.error(e));
