import { Board, Point, PlaceResult } from './types';
export declare function getNeighbors(x: number, y: number, size: number): Point[];
export declare function getGroup(board: Board, x: number, y: number): Point[];
export declare function countLiberties(board: Board, group: Point[]): number;
export declare function placeStone(board: Board, x: number, y: number, player: 1 | 2, koPoint: Point | null): PlaceResult;
export declare function isLegalMove(board: Board, x: number, y: number, player: 1 | 2, koPoint: Point | null): {
    legal: boolean;
    reason?: string;
};
