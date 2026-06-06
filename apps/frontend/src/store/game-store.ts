import { create } from 'zustand';
import { Board, BoardSize, GameMove, GameResult, Point, ScoreResult } from '@go-game/engine';

export type GameStatus = 'idle' | 'waiting' | 'playing' | 'scoring' | 'finished';

interface GameStore {
  // 基础信息
  code: string;
  myColor: 1 | 2 | null;
  myNickname: string;
  opponentNickname: string;
  boardSize: BoardSize;

  // 棋局状态
  status: GameStatus;
  board: Board;
  currentTurn: 1 | 2;
  moves: GameMove[];
  lastMove: Point | null;

  // 数子阶段
  deadStones: Point[];
  territoryMap: number[][] | null;
  scorePreview: ScoreResult | null;
  myConfirmed: boolean;
  opponentConfirmed: boolean;

  // 悔棋
  undoRequested: boolean;

  // 结果
  result: GameResult | null;

  // 复盘
  replayMode: boolean;
  replayIndex: number;

  // Actions
  setCode: (code: string) => void;
  setMyColor: (color: 1 | 2) => void;
  setMyNickname: (name: string) => void;
  setOpponentNickname: (name: string) => void;
  setBoardSize: (size: BoardSize) => void;
  setStatus: (s: GameStatus) => void;
  setBoard: (board: Board) => void;
  setCurrentTurn: (t: 1 | 2) => void;
  setMoves: (moves: GameMove[]) => void;
  setLastMove: (p: Point | null) => void;
  setDeadStones: (stones: Point[]) => void;
  setTerritoryMap: (map: number[][] | null) => void;
  setScorePreview: (score: ScoreResult | null) => void;
  setMyConfirmed: (v: boolean) => void;
  setOpponentConfirmed: (v: boolean) => void;
  setUndoRequested: (v: boolean) => void;
  setResult: (r: GameResult | null) => void;
  enterReplay: () => void;
  exitReplay: () => void;
  setReplayIndex: (i: number) => void;
  reset: () => void;
}

const initialState = {
  code: '',
  myColor: null as 1 | 2 | null,
  myNickname: '',
  opponentNickname: '',
  boardSize: 19 as BoardSize,
  status: 'idle' as GameStatus,
  board: [] as Board,
  currentTurn: 1 as 1 | 2,
  moves: [] as GameMove[],
  lastMove: null as Point | null,
  deadStones: [] as Point[],
  territoryMap: null as number[][] | null,
  scorePreview: null as ScoreResult | null,
  myConfirmed: false,
  opponentConfirmed: false,
  undoRequested: false,
  result: null as GameResult | null,
  replayMode: false,
  replayIndex: 0,
};

export const useGameStore = create<GameStore>((set) => ({
  ...initialState,
  setCode: (code) => set({ code }),
  setMyColor: (myColor) => set({ myColor }),
  setMyNickname: (myNickname) => set({ myNickname }),
  setOpponentNickname: (opponentNickname) => set({ opponentNickname }),
  setBoardSize: (boardSize) => set({ boardSize }),
  setStatus: (status) => set({ status }),
  setBoard: (board) => set({ board }),
  setCurrentTurn: (currentTurn) => set({ currentTurn }),
  setMoves: (moves) => set({ moves }),
  setLastMove: (lastMove) => set({ lastMove }),
  setDeadStones: (deadStones) => set({ deadStones }),
  setTerritoryMap: (territoryMap) => set({ territoryMap }),
  setScorePreview: (scorePreview) => set({ scorePreview }),
  setMyConfirmed: (myConfirmed) => set({ myConfirmed }),
  setOpponentConfirmed: (opponentConfirmed) => set({ opponentConfirmed }),
  setUndoRequested: (undoRequested) => set({ undoRequested }),
  setResult: (result) => set({ result }),
  enterReplay: () => set((s) => ({ replayMode: true, replayIndex: s.moves.length })),
  exitReplay: () => set({ replayMode: false }),
  setReplayIndex: (replayIndex) =>
    set((s) => ({ replayIndex: Math.max(0, Math.min(replayIndex, s.moves.length)) })),
  reset: () => set(initialState),
}));
