import { GameMove } from '@go-game/engine';

interface MoveListProps {
  moves: GameMove[];
  myColor: 1 | 2;
}

const cols = 'ABCDEFGHJKLMNOPQRST';

export default function MoveList({ moves, myColor }: MoveListProps) {
  return (
    <div className="bg-gray-800 rounded-xl p-4 h-full overflow-y-auto">
      <h3 className="text-sm font-semibold text-gray-400 mb-3">手数记录</h3>
      {moves.length === 0 ? (
        <p className="text-gray-600 text-xs text-center mt-4">对局开始后显示</p>
      ) : (
        <div className="space-y-1">
          {moves.map((m, i) => (
            <div
              key={i}
              className={`flex items-center gap-2 px-2 py-1 rounded text-xs ${
                m.player === myColor ? 'bg-gray-700' : ''
              }`}
            >
              <span className="text-gray-500 w-5 text-right">{m.moveNumber}</span>
              <span className={`w-3 h-3 rounded-full inline-block ${m.player === 1 ? 'bg-gray-900 border border-gray-400' : 'bg-white'}`} />
              {'pass' in m ? (
                <span className="text-yellow-500">停一手</span>
              ) : (
                <span className="text-gray-300">
                  {cols[m.x]}{String(m.player === 1 ? 19 - m.y : 19 - m.y)}
                  {m.captured.length > 0 && (
                    <span className="text-red-400 ml-1">提{m.captured.length}子</span>
                  )}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
