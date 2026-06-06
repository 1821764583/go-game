// ============================================================
// judge-engine.ts — 智能裁判（纯启发式，无外部依赖）
//   1. estimateInfluence: 对局中实时形势估算
//   2. detectDeadStones:  终局死子自动识别
//   3. autoJudge:         终局自动裁决（识别死子 + 计分）
// ============================================================

import { Board, Point, Owner, Color, ScoreResult, GameResult } from './types';
import { getNeighbors, getGroup } from './go-engine';
import { applyDeadStones, calculateTerritory, determineWinner } from './scoring-engine';

// ──────────────────────────────────────────────────────────
// 1. 实时形势估算（影响力 / 距离填充）
// ──────────────────────────────────────────────────────────

export interface InfluenceResult {
  // 每个交叉点的归属预测：0=中立 1=黑势 2=白势
  influence: Owner[][];
  // 连续影响力热力图：正值=黑势，负值=白势，绝对值=控制强度（供前端渲染）
  heatmap: number[][];
  // 黑、白各自控制的交叉点数（含己方活子所在点）
  blackArea: number;
  whiteArea: number;
  // 仅空点归属（用于"目数"语义）
  blackTerritory: number;
  whiteTerritory: number;
  // 形势条比例（黑占全盘比例 0~1）
  blackRatio: number;
}

// Bouzy 膨胀-腐蚀（Dilation-Erosion）算法参数。
// 经典配置 "5/21"：先膨胀 5 次，再腐蚀 21 次，得到稳定的势力图。
export interface InfluenceOptions {
  komi?: number;
  dilations?: number; // 膨胀次数（默认 5）
  erosions?: number;  // 腐蚀次数（默认 21）
}

// 膨胀（Dilation）：每个点吸收四邻中同号邻居的影响力。
// 规则（Bouzy）：若某点不与任何异号点相邻，则其值加上四邻中所有同号点的贡献。
function dilate(grid: number[][], size: number): number[][] {
  const next: number[][] = grid.map((row) => [...row]);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const v = grid[y][x];
      let hasPositive = false;
      let hasNegative = false;
      for (const [nx, ny] of getNeighbors(x, y, size)) {
        if (grid[ny][nx] > 0) hasPositive = true;
        else if (grid[ny][nx] < 0) hasNegative = true;
      }
      // 当前点或其邻域不能同时存在黑白冲突时才膨胀
      if (v >= 0 && !hasNegative) {
        for (const [nx, ny] of getNeighbors(x, y, size)) {
          if (grid[ny][nx] > 0) next[y][x] += grid[ny][nx];
        }
      }
      if (v <= 0 && !hasPositive) {
        for (const [nx, ny] of getNeighbors(x, y, size)) {
          if (grid[ny][nx] < 0) next[y][x] += grid[ny][nx];
        }
      }
    }
  }
  return next;
}

// 腐蚀（Erosion）：每个点的绝对值减去四邻中“异号或为零”的邻居个数，
// 直到归零为止。这会削掉虚浮、无支撑的影响力边缘。
function erode(grid: number[][], size: number): number[][] {
  const next: number[][] = grid.map((row) => [...row]);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const v = grid[y][x];
      if (v === 0) continue;
      let opposing = 0;
      for (const [nx, ny] of getNeighbors(x, y, size)) {
        if (v > 0 && grid[ny][nx] <= 0) opposing++;
        else if (v < 0 && grid[ny][nx] >= 0) opposing++;
      }
      if (v > 0) next[y][x] = Math.max(0, v - opposing);
      else next[y][x] = Math.min(0, v + opposing);
    }
  }
  return next;
}

// 影响力扩散（Bouzy 膨胀-腐蚀）。
// 棋子作为光源向四周辐射并随膨胀叠加，再经腐蚀消除虚浮边缘，
// 得到连续的势力热力图（黑正白负），最后按符号归属并统计目数。
export function estimateInfluence(
  board: Board,
  options: number | InfluenceOptions = {},
): InfluenceResult {
  const size = board.length;
  // 向后兼容：旧签名 estimateInfluence(board, komi)
  const opts: InfluenceOptions =
    typeof options === 'number' ? { komi: options } : options;
  const komi = opts.komi ?? 3.75;
  const dilations = opts.dilations ?? 5;
  const erosions = opts.erosions ?? 21;

  // 初始化：黑子 = +1，白子 = -1，空点 = 0
  let grid: number[][] = Array.from({ length: size }, () => new Array(size).fill(0));
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (board[y][x] === 1) grid[y][x] = 1;
      else if (board[y][x] === 2) grid[y][x] = -1;
    }
  }

  for (let i = 0; i < dilations; i++) grid = dilate(grid, size);
  for (let i = 0; i < erosions; i++) grid = erode(grid, size);

  const influence: Owner[][] = Array.from({ length: size }, () => new Array(size).fill(0));
  const heatmap: number[][] = grid;
  let blackArea = 0;
  let whiteArea = 0;
  let blackTerritory = 0;
  let whiteTerritory = 0;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const cell = board[y][x];
      const v = grid[y][x];
      let owner: Owner = 0;
      if (v > 0) owner = 1;
      else if (v < 0) owner = 2;
      influence[y][x] = owner;

      if (owner === 1) {
        blackArea++;
        if (cell === 0) blackTerritory++;
      } else if (owner === 2) {
        whiteArea++;
        if (cell === 0) whiteTerritory++;
      }
    }
  }

  const blackTotal = blackArea;
  const whiteTotal = whiteArea + komi;
  const denom = blackTotal + whiteTotal;
  const blackRatio = denom > 0 ? blackTotal / denom : 0.5;

  return {
    influence,
    heatmap,
    blackArea,
    whiteArea,
    blackTerritory,
    whiteTerritory,
    blackRatio,
  };
}

// ──────────────────────────────────────────────────────────
// 2. 死子自动识别（启发式）
// ──────────────────────────────────────────────────────────

// 计算一块棋的“眼位空间”：与该棋组直接或间接相连、且只被该棋组（同色）包围的空点集合。
// 用 calculateTerritory 思路反推每个棋组的真眼/潜在做眼空间。
//
// 死活启发式判定（针对终局、双方已停止落子的局面）：
//   1. 找出每个棋组所完全包围的“内部空地”（只接触本组同色）。
//   2. 估算这些内部空地能形成的“眼数”：把内部空地按连通块拆分，
//      连通块数量近似等于可做出的眼数（保守估计）。
//   3. 若一个棋组的气全部来自被对方包围的区域，且其内部眼空间 < 2，
//      则判定为死子。
//
// 注意：这是启发式，复杂死活（劫、夹、连环劫、双活）可能误判，
//       因此 autoJudge 返回 confidence，供上层决定是否需人工复核。

interface GroupInfo {
  stones: Point[];
  color: Color;
  liberties: Set<string>;
}

function collectGroups(board: Board): GroupInfo[] {
  const size = board.length;
  const seen = new Set<string>();
  const groups: GroupInfo[] = [];

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const color = board[y][x];
      if (color === 0) continue;
      const key = `${x},${y}`;
      if (seen.has(key)) continue;

      const stones = getGroup(board, x, y);
      stones.forEach(([gx, gy]) => seen.add(`${gx},${gy}`));

      const liberties = new Set<string>();
      for (const [sx, sy] of stones) {
        for (const [nx, ny] of getNeighbors(sx, sy, size)) {
          if (board[ny][nx] === 0) liberties.add(`${nx},${ny}`);
        }
      }
      groups.push({ stones, color, liberties });
    }
  }
  return groups;
}

// 统计一个空点连通区域：返回区域大小、所接触的颜色集合、是否含该区域的连通块标识
function floodEmptyRegions(board: Board): {
  regionId: number[][];
  regions: { id: number; cells: Point[]; borderColors: Set<Color> }[];
} {
  const size = board.length;
  const regionId: number[][] = Array.from({ length: size }, () => new Array(size).fill(-1));
  const regions: { id: number; cells: Point[]; borderColors: Set<Color> }[] = [];
  let id = 0;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (board[y][x] !== 0 || regionId[y][x] !== -1) continue;
      const cells: Point[] = [];
      const borderColors = new Set<Color>();
      const queue: Point[] = [[x, y]];
      regionId[y][x] = id;
      while (queue.length > 0) {
        const [cx, cy] = queue.shift()!;
        cells.push([cx, cy]);
        for (const [nx, ny] of getNeighbors(cx, cy, size)) {
          if (board[ny][nx] !== 0) {
            borderColors.add(board[ny][nx]);
          } else if (regionId[ny][nx] === -1) {
            regionId[ny][nx] = id;
            queue.push([nx, ny]);
          }
        }
      }
      regions.push({ id, cells, borderColors });
      id++;
    }
  }
  return { regionId, regions };
}

export interface DeadStoneResult {
  deadStones: Point[];
  // 0~1，越高越可信；存在双活/劫等复杂情形时降低
  confidence: number;
  // 复杂局面提示（建议人工复核）
  warnings: string[];
}

// 自动识别死子。
export function detectDeadStones(board: Board): DeadStoneResult {
  const size = board.length;
  const groups = collectGroups(board);
  const { regionId, regions } = floodEmptyRegions(board);
  const inf = estimateInfluence(board, 0);

  const warnings: string[] = [];
  const deadSet = new Set<string>();
  let confidence = 1;

  const opp = (c: Color): Color => (c === 1 ? 2 : 1);

  for (const g of groups) {
    const myColor = g.color;
    const enemy = opp(myColor);
    const myStoneSet = new Set<string>(g.stones.map(([x, y]) => `${x},${y}`));

    // 该组气点所属的空地区域
    const touchedRegions = new Set<number>();
    for (const lib of g.liberties) {
      const [lx, ly] = lib.split(',').map(Number);
      touchedRegions.add(regionId[ly][lx]);
    }

    let internalEyeRegions = 0;
    let internalEyeCells = 0;
    let hasOutletToFriend = false;
    let touchesEnemy = false;

    for (const rid of touchedRegions) {
      const region = regions[rid];
      const onlyMyColor =
        region.borderColors.size === 1 && region.borderColors.has(myColor);
      const hasEnemy = region.borderColors.has(enemy);

      // 判断该空地区域是否接触到本组以外的己方棋子
      let touchesFriendNotSelf = false;
      if (region.borderColors.has(myColor)) {
        for (const [rx, ry] of region.cells) {
          for (const [nx, ny] of getNeighbors(rx, ry, size)) {
            if (board[ny][nx] === myColor && !myStoneSet.has(`${nx},${ny}`)) {
              touchesFriendNotSelf = true;
              break;
            }
          }
          if (touchesFriendNotSelf) break;
        }
      }

      if (onlyMyColor) {
        internalEyeRegions++;
        internalEyeCells += region.cells.length;
      }
      if (hasEnemy) touchesEnemy = true;
      if (touchesFriendNotSelf) hasOutletToFriend = true;
    }

    // 方法 1：经典围墙判定
    const surrounded = touchesEnemy && !hasOutletToFriend;
    const looksAlive = internalEyeRegions >= 2 || internalEyeCells >= 7;

    // 只对较小棋组（≤6 子）适用"被围 → 死"的判定。
    // 大棋组（>6 子）极少在终局是全死的，误判代价高，默认保活。
    if (surrounded && !looksAlive && g.stones.length <= 6) {
      for (const [sx, sy] of g.stones) deadSet.add(`${sx},${sy}`);
    }

    // 方法 2：影响力包围判定
    // 如果棋组所有气点的影响力都判属于对方，且棋组本身较小（≤6 子），
    // 说明被对方领地完全包围——判为死子。
    if (!surrounded && g.stones.length <= 6) {
      let allLibsInEnemyZone = g.liberties.size > 0;
      for (const lib of g.liberties) {
        const [lx, ly] = lib.split(',').map(Number);
        if (inf.influence[ly][lx] !== enemy) {
          allLibsInEnemyZone = false;
          break;
        }
      }
      if (allLibsInEnemyZone && !looksAlive) {
        for (const [sx, sy] of g.stones) deadSet.add(`${sx},${sy}`);
        if (g.stones.length > 3) {
          confidence = Math.min(confidence, 0.7);
          warnings.push(
            `位于 (${g.stones[0][0]},${g.stones[0][1]}) 的${myColor === 1 ? '黑' : '白'}棋在对方领地中，判定为死子（建议复核）`,
          );
        }
      }
    }

    if (surrounded && internalEyeRegions === 1) {
      warnings.push(
        `位于 (${g.stones[0][0]},${g.stones[0][1]}) 的${myColor === 1 ? '黑' : '白'}棋仅一处内部空间，死活存疑`,
      );
      confidence = Math.min(confidence, 0.6);
    }
  }

  // 检测可能的双活：某空地区域同时被双方包围且很小（共享气），提示降信心
  for (const region of regions) {
    if (
      region.borderColors.size === 2 &&
      region.cells.length <= 2
    ) {
      // 共享的小空间 → 可能是双活的公气
      warnings.push(`(${region.cells[0][0]},${region.cells[0][1]}) 附近可能为双活，请人工确认`);
      confidence = Math.min(confidence, 0.7);
    }
  }

  const deadStones: Point[] = Array.from(deadSet).map((k) => {
    const [x, y] = k.split(',').map(Number);
    return [x, y] as Point;
  });

  return { deadStones, confidence, warnings };
}

// ──────────────────────────────────────────────────────────
// 3. 终局自动裁决
// ──────────────────────────────────────────────────────────

export interface AutoJudgeResult {
  result: GameResult;
  score: ScoreResult;
  deadStones: Point[];
  confidence: number;
  warnings: string[];
}

// 自动识别死子 → 移除 → 计分 → 判胜负。
// confidence 偏低时，上层应提示玩家人工复核死子。
export function autoJudge(board: Board, komi: number = 3.75): AutoJudgeResult {
  const { deadStones, confidence, warnings } = detectDeadStones(board);

  const { newBoard } = applyDeadStones(board, deadStones);

  let blackStones = 0;
  let whiteStones = 0;
  for (let y = 0; y < newBoard.length; y++) {
    for (let x = 0; x < newBoard[y].length; x++) {
      if (newBoard[y][x] === 1) blackStones++;
      if (newBoard[y][x] === 2) whiteStones++;
    }
  }

  const { blackTerritory, whiteTerritory } = calculateTerritory(newBoard);

  const score: ScoreResult = {
    blackScore: blackStones + blackTerritory,
    whiteScore: whiteStones + whiteTerritory + komi,
    blackStones,
    whiteStones,
    blackTerritory,
    whiteTerritory,
    komi,
  };

  const result = determineWinner(score);

  return { result, score, deadStones, confidence, warnings };
}
