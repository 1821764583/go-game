import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { RoomService } from '../room/room.service';
import { RoomState } from '../room/room.types';
import {
  placeStone,
  calculateScore,
  determineWinner,
  resignResult,
  Point,
} from '@go-game/engine';

@WebSocketGateway({
  cors: { origin: process.env.FRONTEND_URL || 'http://localhost:3000', credentials: true },
  namespace: '/game',
})
export class GameGateway implements OnGatewayDisconnect {
  @WebSocketServer() server: Server;

  constructor(private readonly roomService: RoomService) {}

  // ─── 工具：获取某玩家颜色 ──────────────────────────────────
  private getPlayerColor(room: RoomState, socketId: string): 1 | 2 | null {
    if (room.players.black === socketId) return 1;
    if (room.players.white === socketId) return 2;
    return null;
  }

  private emit(socketId: string, event: string, data: unknown) {
    this.server.to(socketId).emit(event, data);
  }

  private emitError(socketId: string, message: string) {
    this.emit(socketId, 'error', { message });
  }

  private broadcastRoom(room: RoomState, event: string, data: unknown) {
    if (room.players.black) this.emit(room.players.black, event, data);
    if (room.players.white) this.emit(room.players.white, event, data);
  }

  // ─── 1. 创建者进入等待页，绑定 socket ────────────────────────
  @SubscribeMessage('bind_room')
  async handleBindRoom(
    @MessageBody() data: { code: string },
    @ConnectedSocket() client: Socket,
  ) {
    const room = await this.roomService.bindCreator(data.code.toUpperCase(), client.id);
    client.join(data.code);
    this.emit(client.id, 'room_bound', { code: room.code, color: 1, boardSize: room.boardSize });

    // 若对手已加入（页面跳转导致 socket 重建），补发 game_start
    if (room.status === 'playing') {
      this.emit(client.id, 'game_start', {
        board: room.board,
        currentTurn: room.currentTurn,
        nicknames: room.nicknames,
        boardSize: room.boardSize,
      });
    }
  }

  // ─── 2. 好友加入房间 ─────────────────────────────────────────
  @SubscribeMessage('join_room')
  async handleJoinRoom(
    @MessageBody() data: { code: string; nickname: string },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const { room } = await this.roomService.joinRoom(
        data.code.toUpperCase(),
        client.id,
        data.nickname,
      );
      client.join(data.code);

      // 通知加入者
      this.emit(client.id, 'room_joined', {
        code: room.code,
        color: 2,
        boardSize: room.boardSize,
        opponentNickname: room.nicknames.black,
      });

      // 通知创建者（黑棋）好友已加入
      if (room.players.black) {
        this.emit(room.players.black, 'opponent_joined', {
          opponentNickname: room.nicknames.white,
        });
      }

      // 广播游戏开始
      this.broadcastRoom(room, 'game_start', {
        board: room.board,
        currentTurn: room.currentTurn,
        nicknames: room.nicknames,
        boardSize: room.boardSize,
      });
    } catch (e: any) {
      this.emitError(client.id, e.message);
    }
  }

  // ─── 3. 落子 ─────────────────────────────────────────────────
  @SubscribeMessage('place_stone')
  async handlePlaceStone(
    @MessageBody() data: { code: string; x: number; y: number },
    @ConnectedSocket() client: Socket,
  ) {
    const room = await this.roomService.getRoom(data.code.toUpperCase());
    if (!room) return this.emitError(client.id, '房间不存在');
    if (room.status !== 'playing') return this.emitError(client.id, '当前不在对局中');

    const color = this.getPlayerColor(room, client.id);
    if (!color) return this.emitError(client.id, '你不在此房间中');
    if (color !== room.currentTurn) return this.emitError(client.id, '还没到你落子');

    const result = placeStone(room.board, data.x, data.y, color, room.koPoint);
    if (!result.success) return this.emitError(client.id, result.error!);

    // 更新棋盘
    room.board = result.newBoard;
    room.koPoint = result.newKoPoint;
    room.passCount = 0;
    room.currentTurn = color === 1 ? 2 : 1;
    room.moves.push({
      moveNumber: room.moves.length + 1,
      player: color,
      x: data.x,
      y: data.y,
      captured: result.captured,
      timestamp: Date.now(),
    });

    await this.roomService.saveRoom(room);

    this.broadcastRoom(room, 'game_update', {
      board: room.board,
      currentTurn: room.currentTurn,
      lastMove: { x: data.x, y: data.y, player: color },
      captured: result.captured,
      moveNumber: room.moves.length,
    });
  }

  // ─── 4. Pass（停一手） ────────────────────────────────────────
  @SubscribeMessage('pass')
  async handlePass(
    @MessageBody() data: { code: string },
    @ConnectedSocket() client: Socket,
  ) {
    const room = await this.roomService.getRoom(data.code.toUpperCase());
    if (!room) return this.emitError(client.id, '房间不存在');
    if (room.status !== 'playing') return this.emitError(client.id, '当前不在对局中');

    const color = this.getPlayerColor(room, client.id);
    if (!color) return this.emitError(client.id, '你不在此房间中');
    if (color !== room.currentTurn) return this.emitError(client.id, '还没到你操作');

    room.passCount++;
    room.currentTurn = color === 1 ? 2 : 1;
    room.koPoint = null; // pass 清除劫争
    room.moves.push({ moveNumber: room.moves.length + 1, player: color, pass: true, timestamp: Date.now() });

    this.broadcastRoom(room, 'player_passed', { player: color, passCount: room.passCount });

    // 双方都 pass → 进入数子阶段
    if (room.passCount >= 2) {
      room.status = 'scoring';
      room.deadStones = [];
      room.scoringConfirm = { black: false, white: false };
      await this.roomService.saveRoom(room);
      this.broadcastRoom(room, 'enter_scoring', { board: room.board });
    } else {
      await this.roomService.saveRoom(room);
    }
  }

  // ─── 5. 标记死子 ─────────────────────────────────────────────
  @SubscribeMessage('mark_dead')
  async handleMarkDead(
    @MessageBody() data: { code: string; stones: Point[] },
    @ConnectedSocket() client: Socket,
  ) {
    const room = await this.roomService.getRoom(data.code.toUpperCase());
    if (!room) return this.emitError(client.id, '房间不存在');
    if (room.status !== 'scoring') return this.emitError(client.id, '当前不在数子阶段');

    // 替换死子标记，重置双方确认
    room.deadStones = data.stones;
    room.scoringConfirm = { black: false, white: false };
    await this.roomService.saveRoom(room);

    // 预览当前分数
    const score = calculateScore(room.board, room.deadStones);
    this.broadcastRoom(room, 'dead_stones_updated', {
      deadStones: room.deadStones,
      scorePreview: score,
    });
  }

  // ─── 6. 确认死子标记 ─────────────────────────────────────────
  @SubscribeMessage('confirm_score')
  async handleConfirmScore(
    @MessageBody() data: { code: string },
    @ConnectedSocket() client: Socket,
  ) {
    const room = await this.roomService.getRoom(data.code.toUpperCase());
    if (!room) return this.emitError(client.id, '房间不存在');
    if (room.status !== 'scoring') return this.emitError(client.id, '当前不在数子阶段');

    const color = this.getPlayerColor(room, client.id);
    if (!color) return this.emitError(client.id, '你不在此房间中');

    if (color === 1) room.scoringConfirm.black = true;
    if (color === 2) room.scoringConfirm.white = true;

    this.broadcastRoom(room, 'score_confirmed_by', { player: color });

    // 双方都确认 → 结算
    if (room.scoringConfirm.black && room.scoringConfirm.white) {
      const score = calculateScore(room.board, room.deadStones);
      const gameResult = determineWinner(score);
      room.result = gameResult;
      room.status = 'finished';
      await this.roomService.saveRoom(room);
      this.broadcastRoom(room, 'game_over', gameResult);
    } else {
      await this.roomService.saveRoom(room);
    }
  }

  // ─── 7. 对死子有争议 → 继续下棋 ──────────────────────────────
  @SubscribeMessage('dispute_score')
  async handleDisputeScore(
    @MessageBody() data: { code: string },
    @ConnectedSocket() client: Socket,
  ) {
    const room = await this.roomService.getRoom(data.code.toUpperCase());
    if (!room) return this.emitError(client.id, '房间不存在');
    if (room.status !== 'scoring') return this.emitError(client.id, '当前不在数子阶段');

    room.status = 'playing';
    room.passCount = 0;
    room.deadStones = [];
    room.scoringConfirm = { black: false, white: false };
    await this.roomService.saveRoom(room);

    const color = this.getPlayerColor(room, client.id);
    this.broadcastRoom(room, 'score_disputed', { by: color });
  }

  // ─── 8. 认输 ─────────────────────────────────────────────────
  @SubscribeMessage('resign')
  async handleResign(
    @MessageBody() data: { code: string },
    @ConnectedSocket() client: Socket,
  ) {
    const room = await this.roomService.getRoom(data.code.toUpperCase());
    if (!room) return this.emitError(client.id, '房间不存在');
    if (room.status !== 'playing' && room.status !== 'scoring') {
      return this.emitError(client.id, '对局未进行中');
    }

    const color = this.getPlayerColor(room, client.id);
    if (!color) return this.emitError(client.id, '你不在此房间中');

    const gameResult = resignResult(color);
    room.result = gameResult;
    room.status = 'finished';
    await this.roomService.saveRoom(room);
    this.broadcastRoom(room, 'game_over', gameResult);
  }

  // ─── 9. 请求悔棋 ─────────────────────────────────────────────
  @SubscribeMessage('request_undo')
  async handleRequestUndo(
    @MessageBody() data: { code: string },
    @ConnectedSocket() client: Socket,
  ) {
    const room = await this.roomService.getRoom(data.code.toUpperCase());
    if (!room) return this.emitError(client.id, '房间不存在');
    if (room.status !== 'playing') return this.emitError(client.id, '当前不在对局中');
    if (room.moves.length === 0) return this.emitError(client.id, '没有可悔的棋');

    const color = this.getPlayerColor(room, client.id);
    if (!color) return this.emitError(client.id, '你不在此房间中');

    const opponent = color === 1 ? room.players.white : room.players.black;
    if (opponent) {
      this.emit(opponent, 'undo_requested', { by: color });
    }
  }

  // ─── 10. 响应悔棋 ────────────────────────────────────────────
  @SubscribeMessage('respond_undo')
  async handleRespondUndo(
    @MessageBody() data: { code: string; accept: boolean },
    @ConnectedSocket() client: Socket,
  ) {
    const room = await this.roomService.getRoom(data.code.toUpperCase());
    if (!room) return this.emitError(client.id, '房间不存在');

    if (!data.accept) {
      this.broadcastRoom(room, 'undo_result', { accepted: false });
      return;
    }

    // 找到最后一手非 pass 落子并撤销
    let undoneMove = null;
    for (let i = room.moves.length - 1; i >= 0; i--) {
      const m = room.moves[i];
      if (!('pass' in m)) {
        undoneMove = m;
        room.moves.splice(i, 1);
        break;
      }
    }

    if (!undoneMove) {
      return this.emitError(client.id, '没有可悔的棋');
    }

    // 重建棋盘（简单重放）
    const { createEmptyBoard, placeStone: ps } = await import('@go-game/engine');
    let board = createEmptyBoard(room.boardSize);
    let koPoint: Point | null = null;
    for (const m of room.moves) {
      if ('pass' in m) continue;
      const r = ps(board, m.x, m.y, m.player, koPoint);
      if (r.success) { board = r.newBoard; koPoint = r.newKoPoint; }
    }

    room.board = board;
    room.koPoint = koPoint;
    room.currentTurn = undoneMove.player; // 回到被悔棋方
    await this.roomService.saveRoom(room);

    this.broadcastRoom(room, 'undo_result', {
      accepted: true,
      board: room.board,
      currentTurn: room.currentTurn,
      moveNumber: room.moves.length,
    });
  }

  // ─── 断线处理 ────────────────────────────────────────────────
  async handleDisconnect(client: Socket) {
    // 遍历所有房间通知对手（简化：仅打日志，生产环境可加断线重连等待）
    console.log(`Client disconnected: ${client.id}`);
  }
}
