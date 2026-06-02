import { createEmptyBoard, placeStone, isLegalMove } from '../src/go-engine';
import { calculateScore, determineWinner, applyDeadStones } from '../src/scoring-engine';
import { Board } from '../src/types';

// 辅助：快速构建棋盘
function buildBoard(size: number, stones: { x: number; y: number; c: 1 | 2 }[]): Board {
  const b = createEmptyBoard(size as 9 | 13 | 19);
  for (const { x, y, c } of stones) b[y][x] = c;
  return b;
}

describe('GoEngine — 基础落子', () => {
  test('空棋盘落子成功', () => {
    const board = createEmptyBoard(9);
    const result = placeStone(board, 3, 3, 1, null);
    expect(result.success).toBe(true);
    expect(result.newBoard[3][3]).toBe(1);
    expect(result.captured).toHaveLength(0);
  });

  test('落子到有棋子的位置失败', () => {
    const board = createEmptyBoard(9);
    const r1 = placeStone(board, 3, 3, 1, null);
    const r2 = placeStone(r1.newBoard, 3, 3, 2, null);
    expect(r2.success).toBe(false);
    expect(r2.error).toContain('已有棋子');
  });

  test('禁止自杀', () => {
    // 白棋把黑棋围住，黑棋无气时不能落子
    //   . W .
    //   W . W
    //   . W .
    const board = buildBoard(9, [
      { x: 1, y: 0, c: 2 },
      { x: 0, y: 1, c: 2 },
      { x: 2, y: 1, c: 2 },
      { x: 1, y: 2, c: 2 },
    ]);
    const result = placeStone(board, 1, 1, 1, null);
    expect(result.success).toBe(false);
    expect(result.error).toContain('禁止自杀');
  });

  test('提子：单子被围后被提走', () => {
    //   . B .
    //   B W B
    //   . B .
    const board = buildBoard(9, [
      { x: 1, y: 0, c: 1 },
      { x: 0, y: 1, c: 1 },
      { x: 2, y: 1, c: 1 },
      { x: 1, y: 1, c: 2 }, // 白子在中间
    ]);
    // 黑棋落在 (1,2)，包围白子
    const result = placeStone(board, 1, 2, 1, null);
    expect(result.success).toBe(true);
    expect(result.captured).toHaveLength(1);
    expect(result.captured[0]).toEqual([1, 1]);
    expect(result.newBoard[1][1]).toBe(0);
  });

  test('劫争：不能立即回提', () => {
    //   . B W .
    //   B . B W
    //   . B W .
    // 黑棋提白后白棋不能立即回提
    const board = buildBoard(9, [
      { x: 1, y: 0, c: 1 },
      { x: 0, y: 1, c: 1 },
      { x: 2, y: 0, c: 2 },
      { x: 3, y: 1, c: 2 },
      { x: 2, y: 2, c: 2 },
      { x: 2, y: 1, c: 1 }, // 黑子
      { x: 1, y: 2, c: 1 },
    ]);
    // 黑方落子 (1,1) 提白子
    const r1 = placeStone(board, 1, 1, 1, null);
    expect(r1.success).toBe(true);
    expect(r1.captured).toHaveLength(1);

    // 白方立即回提 — 被 ko 禁止
    const koPoint = r1.newKoPoint;
    expect(koPoint).not.toBeNull();
    const r2 = placeStone(r1.newBoard, koPoint![0], koPoint![1], 2, koPoint);
    expect(r2.success).toBe(false);
    expect(r2.error).toContain('劫争');
  });
});

describe('GoEngine — 边界和角', () => {
  test('角落落子合法', () => {
    const board = createEmptyBoard(9);
    const result = placeStone(board, 0, 0, 1, null);
    expect(result.success).toBe(true);
  });

  test('超出边界失败', () => {
    const board = createEmptyBoard(9);
    const result = placeStone(board, 9, 0, 1, null);
    expect(result.success).toBe(false);
  });
});

describe('ScoringEngine — 计分', () => {
  test('空棋盘计分（无死子）', () => {
    const board = createEmptyBoard(9);
    // 黑棋占左半，白棋占右半（简化场景）
    for (let y = 0; y < 9; y++) {
      for (let x = 0; x < 4; x++) board[y][x] = 1;
      for (let x = 5; x < 9; x++) board[y][x] = 2;
    }
    const score = calculateScore(board, [], 3.75);
    expect(score.blackStones).toBe(36); // 4*9
    expect(score.whiteStones).toBe(36); // 4*9
    expect(score.blackTerritory).toBe(9);  // 中间1列空白归黑
  });

  test('applyDeadStones 正确移除死子', () => {
    const board = buildBoard(9, [
      { x: 0, y: 0, c: 2 }, // 白子（死子）
      { x: 1, y: 1, c: 1 }, // 黑子（活子）
    ]);
    const { newBoard, addCapturedByBlack } = applyDeadStones(board, [[0, 0]]);
    expect(newBoard[0][0]).toBe(0);
    expect(addCapturedByBlack).toBe(1);
  });

  test('胜负判断', () => {
    const score = {
      blackScore: 149,
      whiteScore: 145.75,
      blackStones: 87,
      whiteStones: 73,
      blackTerritory: 62,
      whiteTerritory: 54,
      komi: 3.75,
    };
    const result = determineWinner(score);
    expect(result.winner).toBe(1); // 黑胜
    expect(result.margin).toBe(3.3);
  });
});
