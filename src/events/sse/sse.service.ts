import { Injectable } from '@nestjs/common';
import { Subject, Observable } from 'rxjs';

@Injectable()
export class SseService {
  private eventStreams = new Map<string, Subject<any>>();

  getEventStream(channel: string): Observable<any> | undefined {
    if (!this.eventStreams.has(channel)) {
      this.eventStreams.set(channel, new Subject<any>());
    }
    return this.eventStreams.get(channel)?.asObservable();
  }

  broadcast(channel: string, data: any) {
    if (this.eventStreams.has(channel)) {
      this.eventStreams.get(channel)?.next(data);
    }
  }

  removeChannel(channel: string) {
    if (this.eventStreams.has(channel)) {
      this.eventStreams.get(channel)?.complete();
      this.eventStreams.delete(channel);
    }
  }

  getActiveChannels(): string[] {
    return Array.from(this.eventStreams.keys());
  }
}
