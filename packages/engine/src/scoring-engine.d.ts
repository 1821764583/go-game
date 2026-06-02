import { Board, Point, Owner, ScoreResult, GameResult } from './types';
export declare function applyDeadStones(board: Board, deadStones: Point[]): {
    newBoard: Board;
    addCapturedByBlack: number;
    addCapturedByWhite: number;
};
export declare function calculateTerritory(board: Board): {
    territory: Owner[][];
    blackTerritory: number;
    whiteTerritory: number;
};
export declare function calculateScore(board: Board, deadStones: Point[], komi?: number): ScoreResult;
export declare function determineWinner(score: ScoreResult): GameResult;
export declare function resignResult(loser: 1 | 2): GameResult;
