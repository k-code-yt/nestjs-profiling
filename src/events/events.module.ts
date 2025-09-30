import { Module } from '@nestjs/common';
import { WebsocketGatewayWithCompression } from './ws/ws-with-cmpn.service';
import { SseController } from './sse/sse.controller';
import { WSMemoryTrackingInterceptor } from './ws/ws-tracking.interceptor';
import { WebsocketGatewayNoCompression } from './ws/ws-no-cmpn.service';
import { NewsletterBroadcastService } from './newsletter-broadcast-shared.service';
import { StaticService } from './helper';

@Module({
  providers: [
    WebsocketGatewayNoCompression,
    WebsocketGatewayWithCompression,
    NewsletterBroadcastService,
    WSMemoryTrackingInterceptor,
    StaticService,
  ],
  controllers: [SseController],
})
export class EventsModule {}
