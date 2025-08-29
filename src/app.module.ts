import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { MemoryTrackingInterceptor } from './profiling/mem.interceptor';
import { EventsModule } from './events/events.module';
import { MemoryModule } from './profiling/mem.module';

@Module({
  imports: [EventsModule, MemoryModule],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: MemoryTrackingInterceptor,
    },
  ],
})
export class AppModule {}
