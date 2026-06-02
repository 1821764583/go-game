import { BoardSize, Board, GameMove, GameResult, Point } from '@go-game/engine';

export type RoomStatus = 'waiting' | 'playing' | 'scoring' | 'finished';
export type ScoringConfirm = { black: boolean; white: boolean };

export interface RoomState {
  code: string;
  boardSize: BoardSize;
  status: RoomStatus;
  players: {
    black: string | null;  // socket id
    white: string | null;
  };
  nicknames: {
    black: string;
    white: string;
  };
  board: Board;
  currentTurn: 1 | 2;
  moves: GameMove[];
  koPoint: Point | null;
  passCount: number;          // 连续 pass 次数，到 2 触发数子
  deadStones: Point[];        // 数子阶段标记的死子
  scoringConfirm: ScoringConfirm;
  result: GameResult | null;
  createdAt: number;
}
