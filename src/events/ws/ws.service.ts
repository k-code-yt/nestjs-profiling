import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketServer,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Logger, UseInterceptors } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { WSMemoryTrackingInterceptor } from './ws-tracking.interceptor';
import { WSConnectionTracker } from './ws-connection-tracker';
import { MemoryProfilingService } from '../../profiling/mem-profiling.service';
import { PrometheusMetricsService } from '../../profiling/prom-metrics.service';
import * as os from 'os';
import { generateLargePayload } from '../helper';

interface PodInfo {
  podName: string;
  podIp: string;
}

@UseInterceptors(WSMemoryTrackingInterceptor)
@WebSocketGateway({
  cors: {
    origin: '*',
    credentials: true,
  },
  namespace: 'performance',
  compression: true,
  perMessageDeflate: true,
  transports: ['websocket'],
  allowEIO3: false,
  httpCompression: true,
  pingTimeout: 60000,
  pingInterval: 25000,
})
export class WebsocketGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private logger: Logger = new Logger('WebsocketGateway');
  private connectionTracker: WSConnectionTracker;
  private podInfo: PodInfo;

  @WebSocketServer() server: Server;

  constructor(
    private readonly memoryProfilingService: MemoryProfilingService,
    private readonly prometheusMetricsService: PrometheusMetricsService,
  ) {
    this.connectionTracker = new WSConnectionTracker(
      this.memoryProfilingService,
      this.prometheusMetricsService,
    );

    this.podInfo = {
      podName: process.env.POD_NAME || process.env.HOSTNAME || os.hostname(),
      podIp: process.env.POD_IP || 'unknown',
    };
  }

  afterInit(req: any) {
    const server = req.server;
    this.logger.debug('WebSocket Gateway initialized');

    server.engine.opts.perMessageDeflate = {
      threshold: 1024,
      concurrencyLimit: 5,
      serverMaxWindowBits: 10,
      clientMaxWindowBits: 10,
      serverNoContextTakeover: true,
      clientNoContextTakeover: true,
    };
  }

  handleConnection(client: Socket) {
    const transport = client?.conn?.transport?.name;
    this.logger.debug(
      `Engine connection: ${client.id}, transport: ${transport}`,
    );

    this.connectionTracker.trackConnection('connect', client);

    if (client.conn && client.conn.transport) {
      (client.conn.transport as any).supportsBinary = true;
    }

    const interval = setInterval(() => {
      const payload = JSON.stringify(generateLargePayload());
      const messageData = {
        payload,
        ...this.podInfo,
        timestamp: new Date().toISOString(),
        compressed: true,
      };

      this.setupSimpleByteTracking(client, payload);
      client.compress(true).emit('message', messageData);
    }, 1000);

    (client as any).largeDataInterval = interval;
  }

  private setupSimpleByteTracking(client: Socket, uncompressed: string) {
    if ((client as any)._byteTrackingSetup) return;
    (client as any)._byteTrackingSetup = true;

    let totalBytesSent = 0;

    const conn = client.conn as any;
    if (conn && conn?.write) {
      const originalWrite = conn.write.bind(client.conn);

      client.conn.write = (data: any, encoding, callback) => {
        const bytes = Buffer.isBuffer(data)
          ? data.length
          : Buffer.byteLength(String(data), 'utf8');
        totalBytesSent += bytes;
        const uncompressedBytes = uncompressed.length;

        // Record actual network bytes
        this.prometheusMetricsService.recordNetworkBytes(
          'websocket',
          'sent',
          bytes,
          client.id,
        );

        this.prometheusMetricsService.recordWebSocketBytes(
          'sent',
          bytes,
          'deflate',
          client.id,
          uncompressedBytes,
        );

        return originalWrite(data, encoding, callback);
      };
    }
  }

  handleDisconnect(client: Socket) {
    if ((client as any).largeDataInterval) {
      clearInterval((client as any).largeDataInterval);
    }

    this.connectionTracker.trackConnection('disconnect', client);
    client.removeAllListeners();
    client.disconnect(true);
    this.logger.debug(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('message')
  handleMessage(
    @MessageBody() data: any,
    @ConnectedSocket() client: Socket,
  ): string {
    this.logger.log(
      `Received message from ${client.id}: ${JSON.stringify(data)}`,
    );

    let originalMsg;
    if (data && typeof data === 'string') {
      originalMsg = JSON.parse(data)?.message;
    }
    if (data && typeof data === 'object') {
      originalMsg = data?.message;
    }

    const responseData = {
      originalMsg,
      timestamp: new Date().toISOString(),
      ...this.podInfo,
      compressed: true,
    };

    // Enable compression for response
    this.server.to(client.id).compress(true).emit('message', responseData);

    return 'Message received';
  }

  @SubscribeMessage('compressed')
  handleCompressed(
    @MessageBody() data: any,
    @ConnectedSocket() client: Socket,
  ): void {
    this.sendMessageWithMetrics(client, 'compressed', data, 'large-payload');
  }

  private sendMessageWithMetrics(
    client: Socket,
    event: string,
    data: any,
    payloadType: string,
  ) {
    const originalSize = Buffer.byteLength(JSON.stringify(data), 'utf8');

    client.compress(true).emit(event, data);
  }
}
