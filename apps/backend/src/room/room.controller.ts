import { Controller, Post, Get, Body, Param, HttpCode } from '@nestjs/common';
import { RoomService } from './room.service';
import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';
import { BoardSize } from '@go-game/engine';

class CreateRoomDto {
  @IsIn([9, 13, 19])
  boardSize: BoardSize;

  @IsString()
  @MinLength(1)
  @MaxLength(12)
  nickname: string;
}

@Controller('room')
export class RoomController {
  constructor(private readonly roomService: RoomService) {}

  @Post('create')
  @HttpCode(201)
  async createRoom(@Body() dto: CreateRoomDto) {
    const room = await this.roomService.createRoom(dto.boardSize, dto.nickname);
    return {
      code: room.code,
      boardSize: room.boardSize,
      status: room.status,
    };
  }

  @Get(':code')
  async getRoom(@Param('code') code: string) {
    const room = await this.roomService.getRoomOrFail(code.toUpperCase());
    return {
      code: room.code,
      boardSize: room.boardSize,
      status: room.status,
      playerCount: [room.players.black, room.players.white].filter(Boolean).length,
    };
  }
}
