import { Injectable, Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.module';
import { RoomState } from './room.types';
import { createEmptyBoard, BoardSize } from '@go-game/engine';

const ROOM_KEY = (code: string) => `room:${code}`;

@Injectable()
export class RoomService {
  private readonly expireSeconds: number;

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly config: ConfigService,
  ) {
    this.expireSeconds = Number(config.get('ROOM_EXPIRE_SECONDS') || 7200);
  }

  // 生成唯一6位邀请码
  private async generateCode(): Promise<string> {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 去掉易混淆字符
    for (let i = 0; i < 20; i++) {
      let code = '';
      for (let j = 0; j < 6; j++) {
        code += chars[Math.floor(Math.random() * chars.length)];
      }
      const exists = await this.redis.exists(ROOM_KEY(code));
      if (!exists) return code;
    }
    throw new Error('无法生成唯一邀请码，请稍后重试');
  }

  async createRoom(boardSize: BoardSize, nickname: string): Promise<RoomState> {
    const code = await this.generateCode();
    const room: RoomState = {
      code,
      boardSize,
      status: 'waiting',
      players: { black: null, white: null },
      nicknames: { black: nickname, white: '' },
      board: createEmptyBoard(boardSize),
      currentTurn: 1,
      moves: [],
      koPoint: null,
      passCount: 0,
      deadStones: [],
      scoringConfirm: { black: false, white: false },
      result: null,
      createdAt: Date.now(),
    };

    await this.saveRoom(room);
    return room;
  }

  async getRoom(code: string): Promise<RoomState | null> {
    const data = await this.redis.get(ROOM_KEY(code));
    if (!data) return null;
    return JSON.parse(data) as RoomState;
  }

  async getRoomOrFail(code: string): Promise<RoomState> {
    const room = await this.getRoom(code);
    if (!room) throw new NotFoundException(`房间 ${code} 不存在或已过期`);
    return room;
  }

  async saveRoom(room: RoomState): Promise<void> {
    await this.redis.setex(ROOM_KEY(room.code), this.expireSeconds, JSON.stringify(room));
  }

  async deleteRoom(code: string): Promise<void> {
    await this.redis.del(ROOM_KEY(code));
  }

  // 玩家加入房间（分配白棋）
  async joinRoom(code: string, socketId: string, nickname: string): Promise<{ room: RoomState; color: 1 | 2 }> {
    const room = await this.getRoomOrFail(code);

    if (room.status !== 'waiting') {
      throw new BadRequestException('房间已满或对局已开始');
    }
    if (room.players.black === socketId) {
      throw new BadRequestException('你已在房间中');
    }

    room.players.white = socketId;
    room.nicknames.white = nickname;
    room.status = 'playing';

    await this.saveRoom(room);
    return { room, color: 2 };
  }

  // 绑定创建者 socket id
  async bindCreator(code: string, socketId: string): Promise<RoomState> {
    const room = await this.getRoomOrFail(code);
    room.players.black = socketId;
    await this.saveRoom(room);
    return room;
  }
}
