'use client';
import { useRef, useEffect, useCallback } from 'react';
import { Board, BoardSize, Point } from '@go-game/engine';

interface GoBoardProps {
  board: Board;
  boardSize: BoardSize;
  lastMove: Point | null;
  deadStones?: Point[];       // 数子阶段高亮死子
  territoryMap?: number[][];  // 领地标记
  myTurn: boolean;
  onPlace: (x: number, y: number) => void;
  disabled?: boolean;
}

// 星位坐标
const STAR_POINTS: Record<BoardSize, Point[]> = {
  9: [[2,2],[6,2],[2,6],[6,6],[4,4]],
  13: [[3,3],[9,3],[3,9],[9,9],[6,6],[6,3],[3,6],[9,6],[6,9]],
  19: [
    [3,3],[9,3],[15,3],
    [3,9],[9,9],[15,9],
    [3,15],[9,15],[15,15],
  ],
};

export default function GoBoard({
  board, boardSize, lastMove, deadStones = [],
  territoryMap, myTurn, onPlace, disabled = false,
}: GoBoardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hoverRef = useRef<Point | null>(null);

  const PADDING = 28;
  const CANVAS_SIZE = 560;
  const GRID_SIZE = (CANVAS_SIZE - PADDING * 2) / (boardSize - 1);
  const STONE_R = GRID_SIZE * 0.46;

  const toCanvasCoord = (i: number) => PADDING + i * GRID_SIZE;
  const toBoardCoord = (px: number): number => Math.round((px - PADDING) / GRID_SIZE);

  const deadSet = new Set(deadStones.map(([x, y]) => `${x},${y}`));

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    // 棋盘背景
    ctx.fillStyle = '#DCB468';
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    // 木纹纹理（简单渐变模拟）
    const grad = ctx.createLinearGradient(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    grad.addColorStop(0, 'rgba(255,255,255,0.05)');
    grad.addColorStop(1, 'rgba(0,0,0,0.05)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    // 棋盘线
    ctx.strokeStyle = '#8B6914';
    ctx.lineWidth = 1;
    for (let i = 0; i < boardSize; i++) {
      const pos = toCanvasCoord(i);
      ctx.beginPath();
      ctx.moveTo(pos, PADDING);
      ctx.lineTo(pos, CANVAS_SIZE - PADDING);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(PADDING, pos);
      ctx.lineTo(CANVAS_SIZE - PADDING, pos);
      ctx.stroke();
    }

    // 坐标标注
    const cols = 'ABCDEFGHJKLMNOPQRST'; // 跳过 I
    ctx.fillStyle = '#6B4F0A';
    ctx.font = `${GRID_SIZE * 0.28}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < boardSize; i++) {
      const pos = toCanvasCoord(i);
      ctx.fillText(cols[i], pos, PADDING / 2);
      ctx.fillText(cols[i], pos, CANVAS_SIZE - PADDING / 2);
      ctx.fillText(String(boardSize - i), PADDING / 2, pos);
      ctx.fillText(String(boardSize - i), CANVAS_SIZE - PADDING / 2, pos);
    }

    // 星位
    const stars = STAR_POINTS[boardSize] || [];
    for (const [sx, sy] of stars) {
      ctx.beginPath();
      ctx.arc(toCanvasCoord(sx), toCanvasCoord(sy), GRID_SIZE * 0.12, 0, Math.PI * 2);
      ctx.fillStyle = '#8B6914';
      ctx.fill();
    }

    // 领地标记
    if (territoryMap) {
      for (let y = 0; y < boardSize; y++) {
        for (let x = 0; x < boardSize; x++) {
          const owner = territoryMap[y]?.[x];
          if (!owner || board[y][x] !== 0) continue;
          ctx.beginPath();
          const cx = toCanvasCoord(x);
          const cy = toCanvasCoord(y);
          const size = GRID_SIZE * 0.22;
          ctx.rect(cx - size / 2, cy - size / 2, size, size);
          ctx.fillStyle = owner === 1 ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.7)';
          ctx.fill();
        }
      }
    }

    // 棋子
    for (let y = 0; y < boardSize; y++) {
      for (let x = 0; x < boardSize; x++) {
        const color = board[y][x];
        if (!color) continue;
        const cx = toCanvasCoord(x);
        const cy = toCanvasCoord(y);
        const isDead = deadSet.has(`${x},${y}`);

        ctx.beginPath();
        ctx.arc(cx, cy, STONE_R, 0, Math.PI * 2);

        if (color === 1) {
          const g = ctx.createRadialGradient(cx - STONE_R * 0.3, cy - STONE_R * 0.3, 0, cx, cy, STONE_R);
          g.addColorStop(0, '#555');
          g.addColorStop(1, '#000');
          ctx.fillStyle = g;
        } else {
          const g = ctx.createRadialGradient(cx - STONE_R * 0.3, cy - STONE_R * 0.3, 0, cx, cy, STONE_R);
          g.addColorStop(0, '#fff');
          g.addColorStop(1, '#ccc');
          ctx.fillStyle = g;
        }
        ctx.fill();

        // 死子半透明遮罩
        if (isDead) {
          ctx.beginPath();
          ctx.arc(cx, cy, STONE_R, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(255, 80, 80, 0.5)';
          ctx.fill();
          // X 标记
          ctx.strokeStyle = 'red';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(cx - STONE_R * 0.4, cy - STONE_R * 0.4);
          ctx.lineTo(cx + STONE_R * 0.4, cy + STONE_R * 0.4);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(cx + STONE_R * 0.4, cy - STONE_R * 0.4);
          ctx.lineTo(cx - STONE_R * 0.4, cy + STONE_R * 0.4);
          ctx.stroke();
        }
      }
    }

    // 最后一手标记
    if (lastMove) {
      const [lx, ly] = lastMove;
      const cx = toCanvasCoord(lx);
      const cy = toCanvasCoord(ly);
      ctx.beginPath();
      ctx.arc(cx, cy, STONE_R * 0.38, 0, Math.PI * 2);
      ctx.fillStyle = board[ly][lx] === 1 ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.6)';
      ctx.fill();
    }

    // 鼠标悬浮预览
    if (myTurn && !disabled && hoverRef.current) {
      const [hx, hy] = hoverRef.current;
      if (hx >= 0 && hx < boardSize && hy >= 0 && hy < boardSize && board[hy][hx] === 0) {
        ctx.beginPath();
        ctx.arc(toCanvasCoord(hx), toCanvasCoord(hy), STONE_R, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.fill();
      }
    }
  }, [board, boardSize, lastMove, deadStones, territoryMap, myTurn, disabled]);

  useEffect(() => { draw(); }, [draw]);

  const getPoint = (e: React.MouseEvent<HTMLCanvasElement>): Point => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const scaleX = CANVAS_SIZE / rect.width;
    const scaleY = CANVAS_SIZE / rect.height;
    const x = toBoardCoord((e.clientX - rect.left) * scaleX);
    const y = toBoardCoord((e.clientY - rect.top) * scaleY);
    return [x, y];
  };

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!myTurn || disabled) return;
    const [x, y] = getPoint(e);
    if (x >= 0 && x < boardSize && y >= 0 && y < boardSize) {
      onPlace(x, y);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const [x, y] = getPoint(e);
    hoverRef.current = [x, y];
    draw();
  };

  const handleMouseLeave = () => {
    hoverRef.current = null;
    draw();
  };

  return (
    <canvas
      ref={canvasRef}
      width={CANVAS_SIZE}
      height={CANVAS_SIZE}
      onClick={handleClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="rounded-lg shadow-2xl"
      style={{
        width: '100%',
        maxWidth: CANVAS_SIZE,
        cursor: myTurn && !disabled ? 'crosshair' : 'default',
      }}
    />
  );
}
