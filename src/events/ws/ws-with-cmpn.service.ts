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
import { generateNewsletterJSON } from '../helper';
import { NewsletterBroadcastService } from '../newsletter-broadcast-shared.service';

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
  namespace: 'with-cmpn',

  compression: true,
  perMessageDeflate: true,
  transports: ['websocket'],
  allowEIO3: false,
  httpCompression: true,
  pingTimeout: 60000,
  pingInterval: 25000,
})
export class WebsocketGatewayWithCompression
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private logger: Logger = new Logger('WebsocketGateway');
  private connectionTracker: WSConnectionTracker;
  private podInfo: PodInfo;

  @WebSocketServer() server: Server;

  constructor(
    private readonly memoryProfilingService: MemoryProfilingService,
    private readonly prometheusMetricsService: PrometheusMetricsService,
    private readonly newsletterBroadcastService: NewsletterBroadcastService,
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
      `WS WITH Compression connected: ${client.id}, transport: ${transport}`,
    );

    this.connectionTracker.trackConnection('connect', client);

    if (client.conn && client.conn.transport) {
      (client.conn.transport as any).supportsBinary = true;
    }
  }

  handleDisconnect(client: Socket) {
    if ((client as any).largeDataInterval) {
      clearInterval((client as any).largeDataInterval);
    }

    this.connectionTracker.trackConnection('disconnect', client);
    client.removeAllListeners();
    client.disconnect(true);
    this.newsletterBroadcastService.removeConnection(client.id);
    this.logger.debug(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('message')
  handleMessage(@MessageBody() data: any, @ConnectedSocket() client: Socket) {
    this.logger.log(
      `Received message from ${client.id}: ${JSON.stringify(data)}`,
    );

    let originalMsg: {
      type: string;
      messagesPerMinute: number;
      clientId: number;
      timestamp: string;
    } = {} as any;
    if (data && typeof data === 'string') {
      originalMsg = JSON.parse(data);
    }
    if (data && typeof data === 'object') {
      originalMsg = data;
    }

    const messagesPerMinute = originalMsg?.messagesPerMinute || 60;
    Logger.debug(`recieved msg per min ${messagesPerMinute}`, 'WS');
    const interval = setInterval(
      () => {
        const payload = JSON.stringify(generateNewsletterJSON());
        const messageData = {
          payload,
          ...this.podInfo,
          timestamp: new Date().toISOString(),
          compressed: true,
          originalSize: payload.length,
        };

        client.compress(true).emit('message', messageData);
      },
      60000 / Number(originalMsg.messagesPerMinute),
    );

    (client as any).largeDataInterval = interval;
  }

  @SubscribeMessage('newsletter')
  handleNewsletter(
    @MessageBody() data: any,
    @ConnectedSocket() client: Socket,
  ) {
    this.newsletterBroadcastService.addWSConnection(
      client.id,
      client,
      true,
      this.server,
    );
  }
}
