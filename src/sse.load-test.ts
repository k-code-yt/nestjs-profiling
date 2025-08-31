import { EventSource } from 'eventsource';

// SSE Connection Simulator
async function simulateSSEConnections(config?: {
  url: string;
  connectionCount: number;
  durationSeconds: number;
}) {
  const {
    url = 'http://localhost:3000/sse/time',
    connectionCount = 1000,
    durationSeconds = 60,
  } = config || {};

  const stats = {
    connectionsEstablished: 0,
    messagesReceived: 0,
    errors: 0,
    startTime: Date.now(),
  };

  const connections: EventSource[] = [];

  // Create all connections
  for (let i = 0; i < connectionCount; i++) {
    const es = new EventSource(url);

    es.onopen = () => {
      stats.connectionsEstablished++;
      if (stats.connectionsEstablished % 100 === 0) {
        console.log(
          `SSE: ${stats.connectionsEstablished}/${connectionCount} connections established`,
        );
      }
    };

    es.onmessage = (event) => {
      stats.messagesReceived++;
    };

    es.onerror = () => {
      stats.errors++;
    };

    connections.push(es as never);

    // Small delay to avoid overwhelming server
    if (i % 50 === 0) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  // Wait for test duration
  await new Promise((resolve) => setTimeout(resolve, durationSeconds * 1000));

  // Close all connections
  connections.forEach((es: any) => {
    es.onopen = null;
    es.onmessage = null;
    es.onerror = null;
    es.close();
  });

  const totalTime = (Date.now() - stats.startTime) / 1000;
  return {
    protocol: 'SSE',
    connectionsEstablished: stats.connectionsEstablished,
    messagesReceived: stats.messagesReceived,
    messagesPerSecond: stats.messagesReceived / totalTime,
    errors: stats.errors,
    testDuration: totalTime,
    memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024,
  };
}

simulateSSEConnections()
  .then((r) => console.log({ r }))
  .catch((e) => console.error(e));
