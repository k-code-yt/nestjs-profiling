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
  // Force WebSocket compression
  compression: true,
  perMessageDeflate: true, // Simplified - force enable
  // Additional options
  transports: ['websocket'], // WebSocket only
  allowEIO3: false,
  httpCompression: true,
  // Engine.IO options for compression
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
      concurrencyLimit: 10,
      // Enable compression
      serverMaxWindowBits: 15,
      clientMaxWindowBits: 15,
      serverNoContextTakeover: false,
      clientNoContextTakeover: false,
    };

    // Force compression on connection
    server.engine.on('connection', (socket) => {
      this.logger.debug(
        `Engine connection: ${socket.id}, transport: ${socket.transport?.name}`,
      );

      if (socket.transport?.name === 'websocket') {
        // Enable per-message deflate
        socket.transport.perMessageDeflate = true;
        this.logger.debug('WebSocket compression enabled for connection');
      }
    });
  }

  handleConnection(client: Socket) {
    this.logger.debug(`Client connected: ${client.id}`);
    this.connectionTracker.trackConnection('connect', client);

    // Enable compression for this specific client
    if (client.conn && client.conn.transport) {
      (client.conn.transport as any).supportsBinary = true;
    }

    const interval = setInterval(() => {
      const payload = generateLargePayload();
      const messageData = {
        payload,
        ...this.podInfo,
        timestamp: new Date().toISOString(),
        compressed: true, // Indicate compression is enabled
      };

      const payloadStr = JSON.stringify(messageData);
      this.logger.debug(`WS payload size: ${payloadStr.length} bytes`);

      // Use binary mode if available for better compression
      client.compress(true).emit('message', messageData);
    }, 1000);

    (client as any).largeDataInterval = interval;
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
}
