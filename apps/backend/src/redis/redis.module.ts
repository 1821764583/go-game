import { Module, Global } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

export const REDIS_CLIENT = 'REDIS_CLIENT';

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      useFactory: (config: ConfigService) => {
        const client = new Redis(config.get('REDIS_URL') as string || 'redis://localhost:6379');
        client.on('connect', () => console.log('Redis connected'));
        client.on('error', (err) => console.error('Redis error:', err));
        return client;
      },
      inject: [ConfigService],
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}
