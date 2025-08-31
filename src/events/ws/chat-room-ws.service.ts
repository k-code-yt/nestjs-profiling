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
import { BadRequestException, Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';

interface RoomInfo {
  roomId: string;
  clients: Set<string>;
  createdAt: Date;
  lastActivity: Date;
}

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: 'users',
})
export class ChatWebsocketGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private logger: Logger = new Logger('WebsocketGateway');
  private rooms: Map<string, RoomInfo> = new Map();
  @WebSocketServer() server: Server;

  afterInit(server: Server) {
    this.logger.log('WebSocket Gateway initialized');
  }

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    client.removeAllListeners();
    client.disconnect(true);
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('broadcast')
  handleBroadcast(
    @MessageBody() data: any,
    @ConnectedSocket() client: Socket,
  ): void {
    this.server.emit('broadcast', {
      message: `Broadcast to all: ${data?.message || ''}`,
      timestamp: new Date().toISOString(),
      fromClient: client.id,
    });
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
    });

    return 'Message received';
  }

  @SubscribeMessage('joinRoom')
  handleJoinRoom(
    @MessageBody()
    data: { roomId: string; username?: string } = { roomId: 'room1' },
    @ConnectedSocket() client: Socket,
  ) {
    const { roomId, username } = data;

    client.join(roomId);

    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, {
        roomId,
        clients: new Set(),
        createdAt: new Date(),
        lastActivity: new Date(),
      });
    }

    const room = this.rooms.get(roomId);
    if (room) {
      room.clients.add(client.id);
      room.lastActivity = new Date();
    }

    client.emit('joinRoom', {
      roomId,
      clientId: client.id,
      clientsInRoom: room?.clients?.size,
    });

    this.logger.log(`Client ${client.id} joined room ${roomId}`);
    return {
      roomId,
      clientId: client.id,
      username: username || `User-${client.id.slice(0, 6)}`,
      clientsInRoom: room?.clients?.size,
    };
  }

  @SubscribeMessage('roomMessage')
  handleRoomMessage(
    @MessageBody() data: { roomId: string; message: string },
    @ConnectedSocket() client: Socket,
  ): void {
    const { roomId, message } = data;

    const room = this.rooms.get(roomId);
    if (!room?.clients.has(client.id) || !client.rooms.has(roomId)) {
      this.server
        .to(client.id)
        .emit('roomMessage', { error: 'You are not in this room' });
      return;
    }

    if (room) {
      room.lastActivity = new Date();
    }

    this.server.to(roomId).emit('roomMessage', {
      roomId,
      message,
      from: client.id,
      timestamp: new Date().toISOString(),
    });

    this.logger.log(`Room message in ${roomId} from ${client.id}: ${message}`);
  }

  @SubscribeMessage('getRoomInfo')
  handleGetRoomInfo(
    @MessageBody() data: { roomId: string },
    @ConnectedSocket() client: Socket,
  ): any {
    const room = this.rooms.get(data.roomId);
    if (room) {
      return {
        roomId: room.roomId,
        clientCount: room.clients.size,
        clients: Array.from(room.clients),
        createdAt: room.createdAt,
        lastActivity: room.lastActivity,
      };
    }

    throw new BadRequestException('Room not found');
  }

  @SubscribeMessage('listRooms')
  handleListRooms(@ConnectedSocket() client: Socket) {
    const roomList = Array.from(this.rooms.entries()).map(([roomId, room]) => ({
      roomId,
      clientCount: room.clients.size,
      createdAt: room.createdAt,
      lastActivity: room.lastActivity,
    }));

    return roomList;
  }

  @SubscribeMessage('leaveRoom')
  handleLeaveRoom(
    @MessageBody() data: { roomId: string },
    @ConnectedSocket() client: Socket,
  ): void {
    const { roomId } = data;
    this.leaveRoom(client, roomId);
  }

  private leaveRoom(client: Socket, roomId: string): void {
    if (client.rooms.has(roomId)) {
      client.leave(roomId);
    }

    const room = this.rooms.get(roomId);

    if (room) {
      room.clients.delete(client.id);

      if (room.clients.size === 0) {
        this.rooms.delete(roomId);
      } else {
        room.lastActivity = new Date();

        client.to(roomId).emit('userLeft', {
          roomId,
          clientId: client.id,
          clientsInRoom: room.clients.size,
        });
      }
    }

    client.emit('roomLeft', { roomId });
    this.logger.log(`Client ${client.id} left room ${roomId}`);
  }
}
