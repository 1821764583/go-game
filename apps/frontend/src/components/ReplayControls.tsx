'use client';
import { useEffect } from 'react';
import {
  SkipBack,
  SkipForward,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Play,
  Pause,
} from 'lucide-react';
import { GameMove } from '@go-game/engine';

interface ReplayControlsProps {
  index: number;
  total: number;
  label: string | null; // 当前手的描述，如 "黑 Q16" / "停一手"
  playing: boolean;
  onChange: (i: number) => void;
  onTogglePlay: () => void;
  onExit: () => void;
}

const cols = 'ABCDEFGHJKLMNOPQRST';

export function formatMoveLabel(move: GameMove | null, boardSize: number): string | null {
  if (!move) return null;
  const who = move.player === 1 ? '黑' : '白';
  if ('pass' in move) return `${who} 停一手`;
  return `${who} ${cols[move.x]}${boardSize - move.y}`;
}

function IconBtn({
  onClick,
  disabled,
  title,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="flex items-center justify-center w-9 h-9 text-white hover:text-amber-300 disabled:opacity-30 disabled:hover:text-white transition-colors"
    >
      {children}
    </button>
  );
}

export default function ReplayControls({
  index,
  total,
  label,
  playing,
  onChange,
  onTogglePlay,
  onExit,
}: ReplayControlsProps) {
  const atStart = index <= 0;
  const atEnd = index >= total;

  useEffect(() => {
    if (!playing) return;
    if (atEnd) return;
    const t = setTimeout(() => onChange(index + 1), 900);
    return () => clearTimeout(t);
  }, [playing, index, atEnd, onChange]);

  return (
    <div className="bg-gray-800 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-amber-400">复盘</span>
        <span className="text-xs text-gray-400">
          第 {index} / {total} 手
        </span>
      </div>

      {/* 当前手描述 */}
      <div className="text-center text-sm text-gray-200 bg-gray-900/60 rounded-lg py-1.5">
        {index === 0 ? '开始（空盘）' : label ?? '—'}
      </div>

      <input
        type="range"
        min={0}
        max={total}
        value={index}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-amber-500"
      />

      {/* 图标控制条（胶囊样式） */}
      <div className="flex items-center justify-center gap-1 bg-indigo-900/70 rounded-full px-2 py-1">
        <IconBtn onClick={() => onChange(0)} disabled={atStart} title="第一手">
          <SkipBack size={18} fill="currentColor" />
        </IconBtn>
        <IconBtn onClick={() => onChange(Math.max(0, index - 5))} disabled={atStart} title="快退5手">
          <ChevronsLeft size={20} />
        </IconBtn>
        <IconBtn onClick={() => onChange(index - 1)} disabled={atStart} title="上一手">
          <ChevronLeft size={20} />
        </IconBtn>
        <IconBtn onClick={() => onChange(index + 1)} disabled={atEnd} title="下一手">
          <ChevronRight size={20} />
        </IconBtn>
        <IconBtn onClick={() => onChange(Math.min(total, index + 5))} disabled={atEnd} title="快进5手">
          <ChevronsRight size={20} />
        </IconBtn>
        <IconBtn onClick={() => onChange(total)} disabled={atEnd} title="最后一手">
          <SkipForward size={18} fill="currentColor" />
        </IconBtn>
      </div>

      <button
        onClick={onTogglePlay}
        disabled={atEnd && !playing}
        className={`w-full py-2 rounded-full text-white text-sm transition-colors disabled:opacity-40 flex items-center justify-center gap-1.5 ${
          playing ? 'bg-amber-600 hover:bg-amber-500' : 'bg-indigo-700 hover:bg-indigo-600'
        }`}
      >
        {playing ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
        {playing ? '暂停' : '自动播放'}
      </button>

      <button
        onClick={onExit}
        className="w-full py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-sm transition-colors"
      >
        退出复盘
      </button>
    </div>
  );
}
