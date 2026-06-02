// ============================================================
// go-engine.ts — 围棋落子规则引擎
// ============================================================

import { Board, Color, Point, PlaceResult, cloneBoard } from './types';

// 获取相邻四个交叉点
export function getNeighbors(x: number, y: number, size: number): Point[] {
  const neighbors: Point[] = [];
  if (x > 0) neighbors.push([x - 1, y]);
  if (x < size - 1) neighbors.push([x + 1, y]);
  if (y > 0) neighbors.push([x, y - 1]);
  if (y < size - 1) neighbors.push([x, y + 1]);
  return neighbors;
}

// 获取一组连通同色棋子（BFS）
export function getGroup(board: Board, x: number, y: number): Point[] {
  const size = board.length;
  const color = board[y][x];
  if (color === 0) return [];

  const visited = new Set<string>();
  const group: Point[] = [];
  const queue: Point[] = [[x, y]];
  visited.add(`${x},${y}`);

  while (queue.length > 0) {
    const [cx, cy] = queue.shift()!;
    group.push([cx, cy]);
    for (const [nx, ny] of getNeighbors(cx, cy, size)) {
      const key = `${nx},${ny}`;
      if (!visited.has(key) && board[ny][nx] === color) {
        visited.add(key);
        queue.push([nx, ny]);
      }
    }
  }
  return group;
}

// 计算一组棋子的气数
export function countLiberties(board: Board, group: Point[]): number {
  const size = board.length;
  const libertySet = new Set<string>();
  for (const [x, y] of group) {
    for (const [nx, ny] of getNeighbors(x, y, size)) {
      if (board[ny][nx] === 0) {
        libertySet.add(`${nx},${ny}`);
      }
    }
  }
  return libertySet.size;
}

// 检查并返回因落子导致被提走的对方棋子
function findCaptures(board: Board, x: number, y: number, player: 1 | 2): Point[] {
  const size = board.length;
  const opponent = player === 1 ? 2 : 1;
  const captured: Point[] = [];
  const checkedGroups = new Set<string>();

  for (const [nx, ny] of getNeighbors(x, y, size)) {
    if (board[ny][nx] !== opponent) continue;
    const key = `${nx},${ny}`;
    if (checkedGroups.has(key)) continue;

    const group = getGroup(board, nx, ny);
    group.forEach(([gx, gy]) => checkedGroups.add(`${gx},${gy}`));
    if (countLiberties(board, group) === 0) {
      captured.push(...group);
    }
  }
  return captured;
}

// 判断是否违反禁止自杀规则（提子后若己方无气则非法）
function isSuicide(board: Board, x: number, y: number, player: 1 | 2): boolean {
  // 落子后的假设棋盘
  const testBoard = cloneBoard(board);
  testBoard[y][x] = player;

  // 先检查能否提子（提子后有气则合法）
  const captured = findCaptures(testBoard, x, y, player);
  if (captured.length > 0) return false;

  // 检查己方棋组是否有气
  const myGroup = getGroup(testBoard, x, y);
  return countLiberties(testBoard, myGroup) === 0;
}

// 判断是否违反劫争规则
function isKo(
  newBoard: Board,
  koPoint: Point | null,
  x: number,
  y: number
): boolean {
  if (!koPoint) return false;
  return koPoint[0] === x && koPoint[1] === y;
}

// 计算新的劫争禁点
// 劫争：落子后恰好提走对方一颗子，且己方棋组只有一口气
function computeNewKoPoint(
  board: Board,
  x: number,
  y: number,
  player: 1 | 2,
  captured: Point[]
): Point | null {
  if (captured.length !== 1) return null;
  const myGroup = getGroup(board, x, y);
  if (myGroup.length !== 1) return null;
  if (countLiberties(board, myGroup) !== 1) return null;
  return captured[0];
}

// 执行落子（主入口）
export function placeStone(
  board: Board,
  x: number,
  y: number,
  player: 1 | 2,
  koPoint: Point | null
): PlaceResult {
  const size = board.length;

  // 边界检查
  if (x < 0 || x >= size || y < 0 || y >= size) {
    return { success: false, newBoard: board, captured: [], newKoPoint: koPoint, error: '落子超出棋盘范围' };
  }

  // 已有棋子
  if (board[y][x] !== 0) {
    return { success: false, newBoard: board, captured: [], newKoPoint: koPoint, error: '该位置已有棋子' };
  }

  // 劫争禁手
  if (isKo(board, koPoint, x, y)) {
    return { success: false, newBoard: board, captured: [], newKoPoint: koPoint, error: '劫争禁止立即回提' };
  }

  // 禁止自杀
  if (isSuicide(board, x, y, player)) {
    return { success: false, newBoard: board, captured: [], newKoPoint: koPoint, error: '禁止自杀' };
  }

  // 执行落子
  const newBoard = cloneBoard(board);
  newBoard[y][x] = player;

  // 提子
  const captured = findCaptures(newBoard, x, y, player);
  for (const [cx, cy] of captured) {
    newBoard[cy][cx] = 0;
  }

  // 计算新劫争点
  const newKoPoint = computeNewKoPoint(newBoard, x, y, player, captured);

  return { success: true, newBoard, captured, newKoPoint };
}

// 验证落子是否合法（不改变棋盘，仅判断）
export function isLegalMove(
  board: Board,
  x: number,
  y: number,
  player: 1 | 2,
  koPoint: Point | null
): { legal: boolean; reason?: string } {
  const result = placeStone(board, x, y, player, koPoint);
  return result.success
    ? { legal: true }
    : { legal: false, reason: result.error };
}
