export const generateLargePayload = () => {
  const baseData = {
    time: new Date().toISOString(),
    timestamp: Date.now(),
    systemMetrics: {
      cpu: Array.from({ length: 50 }, (_, i) => ({
        core: i,
        usage: Math.random() * 100,
        temperature: 30 + Math.random() * 40,
        frequency: 2400 + Math.random() * 1000,
      })),
      memory: {
        total: 16777216,
        used: Math.floor(Math.random() * 10000000),
        available: Math.floor(Math.random() * 6777216),
        buffers: Math.floor(Math.random() * 1000000),
        cached: Math.floor(Math.random() * 2000000),
        processes: Array.from({ length: 20 }, (_, i) => ({
          pid: 1000 + i,
          name: `process_${i}`,
          memory: Math.floor(Math.random() * 100000),
          cpu: Math.random() * 10,
        })),
      },
      network: {
        interfaces: ['eth0', 'eth1', 'lo'].map((name) => ({
          name,
          bytesIn: Math.floor(Math.random() * 1000000000),
          bytesOut: Math.floor(Math.random() * 1000000000),
          packetsIn: Math.floor(Math.random() * 1000000),
          packetsOut: Math.floor(Math.random() * 1000000),
          errors: Math.floor(Math.random() * 100),
        })),
      },
      disk: Array.from({ length: 3 }, (_, i) => ({
        device: `/dev/sda${i + 1}`,
        size: 1000000000 + Math.random() * 500000000,
        used: Math.random() * 800000000,
        available: Math.random() * 200000000,
        mountPoint: i === 0 ? '/' : `/mnt/disk${i}`,
      })),
    },
  };

  const jsonStr = JSON.stringify(baseData);
  const targetSize = 10240; // 10kb
  if (jsonStr.length < targetSize) {
    baseData['padding'] = 'x'.repeat(Math.floor(targetSize - jsonStr.length));
  }

  return baseData;
};
