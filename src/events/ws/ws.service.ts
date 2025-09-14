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
  },
  namespace: 'performance',
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

  afterInit(server: Server) {
    this.logger.debug('WebSocket Gateway initialized');
  }

  handleConnection(client: Socket) {
    this.logger.debug(`Client connected: ${client.id}`);
    this.connectionTracker.trackConnection('connect', client);

    const interval = setInterval(() => {
      const payload = generateLargePayload();
      const payloadStr = JSON.stringify({ payload, ...this.podInfo });

      this.logger.debug(`WS payload size: ${payloadStr.length} bytes`);

      client.emit('message', payload);
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

    this.server.to(client.id).emit('message', {
      originalMsg,
      timestamp: new Date().toISOString(),
      ...this.podInfo,
    });

    return 'Message received';
  }
}
