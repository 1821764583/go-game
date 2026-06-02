export type BoardSize = 9 | 13 | 19;
export type Color = 0 | 1 | 2;
export type Board = Color[][];
export type Point = [number, number];
export type Owner = 0 | 1 | 2;
export interface Move {
    moveNumber: number;
    player: 1 | 2;
    x: number;
    y: number;
    captured: Point[];
    timestamp: number;
}
export interface PassMove {
    moveNumber: number;
    player: 1 | 2;
    pass: true;
    timestamp: number;
}
export type GameMove = Move | PassMove;
export interface PlaceResult {
    success: boolean;
    newBoard: Board;
    captured: Point[];
    newKoPoint: Point | null;
    error?: string;
}
export interface ScoreResult {
    blackScore: number;
    whiteScore: number;
    blackStones: number;
    whiteStones: number;
    blackTerritory: number;
    whiteTerritory: number;
    komi: number;
}
export interface GameResult {
    winner: 1 | 2;
    margin: number;
    reason: 'score' | 'resign';
    score?: ScoreResult;
}
export declare function createEmptyBoard(size: BoardSize): Board;
export declare function cloneBoard(board: Board): Board;
