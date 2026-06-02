// ============================================================
// scoring-engine.ts — 终局判断与计分引擎
// ============================================================

import { Board, Point, Owner, ScoreResult, GameResult, cloneBoard } from './types';
import { getNeighbors } from './go-engine';

// 将死子从棋盘上移除，返回各方提子数增量
export function applyDeadStones(
  board: Board,
  deadStones: Point[]
): { newBoard: Board; addCapturedByBlack: number; addCapturedByWhite: number } {
  const newBoard = cloneBoard(board);
  let addCapturedByBlack = 0;
  let addCapturedByWhite = 0;

  for (const [x, y] of deadStones) {
    const color = newBoard[y][x];
    if (color === 1) addCapturedByWhite++;   // 黑子死了，白方提子+1
    if (color === 2) addCapturedByBlack++;   // 白子死了，黑方提子+1
    newBoard[y][x] = 0;
  }

  return { newBoard, addCapturedByBlack, addCapturedByWhite };
}

// BFS 洪水填充：计算每片空地的归属
export function calculateTerritory(board: Board): {
  territory: Owner[][];
  blackTerritory: number;
  whiteTerritory: number;
} {
  const size = board.length;
  const visited: boolean[][] = Array.from({ length: size }, () => new Array(size).fill(false));
  const territory: Owner[][] = Array.from({ length: size }, () => new Array(size).fill(0));
  let blackTerritory = 0;
  let whiteTerritory = 0;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (board[y][x] !== 0 || visited[y][x]) continue;

      // BFS 扩展当前连通空地
      const emptyGroup: Point[] = [];
      const borderingColors = new Set<number>();
      const queue: Point[] = [[x, y]];
      visited[y][x] = true;

      while (queue.length > 0) {
        const [cx, cy] = queue.shift()!;
        emptyGroup.push([cx, cy]);

        for (const [nx, ny] of getNeighbors(cx, cy, size)) {
          if (board[ny][nx] !== 0) {
            borderingColors.add(board[ny][nx]);
          } else if (!visited[ny][nx]) {
            visited[ny][nx] = true;
            queue.push([nx, ny]);
          }
        }
      }

      // 判断归属：只接触一种颜色才归属该方，否则为争议地
      let owner: Owner = 0;
      if (borderingColors.size === 1) {
        owner = borderingColors.has(1) ? 1 : 2;
      }

      for (const [ex, ey] of emptyGroup) {
        territory[ey][ex] = owner;
      }
      if (owner === 1) blackTerritory += emptyGroup.length;
      if (owner === 2) whiteTerritory += emptyGroup.length;
    }
  }

  return { territory, blackTerritory, whiteTerritory };
}

// 计算最终得分（中国规则：活子 + 领地）
export function calculateScore(
  board: Board,
  deadStones: Point[],
  komi: number = 3.75
): ScoreResult {
  // 1. 移除死子
  const { newBoard } = applyDeadStones(board, deadStones);

  // 2. 数活子
  let blackStones = 0;
  let whiteStones = 0;
  for (let y = 0; y < newBoard.length; y++) {
    for (let x = 0; x < newBoard[y].length; x++) {
      if (newBoard[y][x] === 1) blackStones++;
      if (newBoard[y][x] === 2) whiteStones++;
    }
  }

  // 3. 计算领地
  const { blackTerritory, whiteTerritory } = calculateTerritory(newBoard);

  // 4. 中国规则：活子 + 领地
  const blackScore = blackStones + blackTerritory;
  const whiteScore = whiteStones + whiteTerritory + komi;

  return {
    blackScore,
    whiteScore,
    blackStones,
    whiteStones,
    blackTerritory,
    whiteTerritory,
    komi,
  };
}

// 判断胜负
export function determineWinner(score: ScoreResult): GameResult {
  const winner: 1 | 2 = score.blackScore > score.whiteScore ? 1 : 2;
  const margin = parseFloat(Math.abs(score.blackScore - score.whiteScore).toFixed(1));
  return {
    winner,
    margin,
    reason: 'score',
    score,
  };
}

// 由认输直接判负
export function resignResult(loser: 1 | 2): GameResult {
  return {
    winner: loser === 1 ? 2 : 1,
    margin: 0,
    reason: 'resign',
  };
}
