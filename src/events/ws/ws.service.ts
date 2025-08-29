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

@UseInterceptors(WSMemoryTrackingInterceptor)
@WebSocketGateway({
  cors: {
    origin: '*',
  },
  transports: 'websocket',
})
export class WebsocketGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() server: Server;
  private logger: Logger = new Logger('WebsocketGateway');

  afterInit(server: Server) {
    this.logger.log('WebSocket Gateway initialized');
  }

  handleConnection(client: Socket, ...args: any[]) {
    this.logger.log(`Client connected: ${client.id}`);
    client.emit('welcome', { message: 'Welcome to the WebSocket server!' });
  }

  handleDisconnect(client: Socket) {
    client.removeAllListeners();
    client.disconnect(true);
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('message')
  handleMessage(
    @MessageBody() data: any,
    @ConnectedSocket() client: Socket,
  ): string {
    this.logger.log(
      `Received message from ${client.id}: ${JSON.stringify(data)}`,
    );

    // Echo the message back to the sender
    client.emit('messageResponse', {
      message: `Echo: ${data.message}`,
      timestamp: new Date().toISOString(),
    });

    // client.broadcast.emit('broadcast', {
    //   message: data.message,
    //   from: client.id,
    //   timestamp: new Date().toISOString(),
    // });

    return 'Message received';
  }
}
