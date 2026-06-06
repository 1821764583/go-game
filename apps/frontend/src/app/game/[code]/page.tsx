'use client';
import { useEffect, useRef, useState, useCallback, useMemo, Suspense } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { io, Socket } from 'socket.io-client';
import GoBoard from '@/components/GoBoard';
import MoveList from '@/components/MoveList';
import ReplayControls, { formatMoveLabel } from '@/components/ReplayControls';
import { useGameStore } from '@/store/game-store';
import { Board, BoardSize, GameMove, Point, ScoreResult, GameResult, createEmptyBoard, estimateInfluence, buildReplaySnapshots } from '@go-game/engine';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3001';

export default function GamePage() {
  return (
    <Suspense>
      <GamePageInner />
    </Suspense>
  );
}

function GamePageInner() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const code = (params.code as string).toUpperCase();
  const isJoining = searchParams.get('join') === '1';
  const nicknameParam = searchParams.get('nickname') || '';

  const socketRef = useRef<Socket | null>(null);
  const [serverError, setServerError] = useState('');
  const [showResult, setShowResult] = useState(false);
  const [showInfluence, setShowInfluence] = useState(false);
  const [replayPlaying, setReplayPlaying] = useState(false);

  const {
    myColor, myNickname, opponentNickname, boardSize,
    status, board, currentTurn, moves, lastMove,
    deadStones, territoryMap, scorePreview,
    myConfirmed, opponentConfirmed, undoRequested, result,
    replayMode, replayIndex,
    setCode, setMyColor, setMyNickname, setOpponentNickname, setBoardSize,
    setStatus, setBoard, setCurrentTurn, setMoves, setLastMove,
    setDeadStones, setTerritoryMap, setScorePreview,
    setMyConfirmed, setOpponentConfirmed, setUndoRequested, setResult,
    enterReplay, exitReplay, setReplayIndex,
  } = useGameStore();

  // ── Socket 初始化 ────────────────────────────────────────────
  useEffect(() => {
    const nickname = nicknameParam || sessionStorage.getItem('nickname') || '玩家';
    setMyNickname(nickname);
    setCode(code);

    const socket: Socket = io(`${WS_URL}/game`);
    socketRef.current = socket;

    socket.on('connect', () => {
      if (isJoining) {
        socket.emit('join_room', { code, nickname });
      } else {
        socket.emit('bind_room', { code });
      }
    });

    // 等待页绑定成功
    socket.on('room_bound', (data: { color: 1 | 2; boardSize: BoardSize }) => {
      setMyColor(data.color);
      setBoardSize(data.boardSize);
      setBoard(createEmptyBoard(data.boardSize));
      setStatus('waiting');
    });

    // 好友加入后加入者收到的回调
    socket.on('room_joined', (data: { color: 1 | 2; boardSize: BoardSize; opponentNickname: string }) => {
      setMyColor(data.color);
      setBoardSize(data.boardSize);
      setBoard(createEmptyBoard(data.boardSize));
      setOpponentNickname(data.opponentNickname);
    });

    // 游戏开始
    socket.on('game_start', (data: {
      board: Board; currentTurn: 1 | 2;
      nicknames: { black: string; white: string }; boardSize: BoardSize;
    }) => {
      setBoard(data.board);
      setCurrentTurn(data.currentTurn);
      setBoardSize(data.boardSize);
      setStatus('playing');
      const myC = useGameStore.getState().myColor;
      setOpponentNickname(myC === 1 ? data.nicknames.white : data.nicknames.black);
    });

    // 落子同步
    socket.on('game_update', (data: {
      board: Board; currentTurn: 1 | 2;
      lastMove: { x: number; y: number; player: 1 | 2 };
      captured: Point[]; moveNumber: number;
    }) => {
      setBoard(data.board);
      setCurrentTurn(data.currentTurn);
      setLastMove([data.lastMove.x, data.lastMove.y]);
      const move: GameMove = {
        moveNumber: data.moveNumber,
        player: data.lastMove.player,
        x: data.lastMove.x,
        y: data.lastMove.y,
        captured: data.captured,
        timestamp: Date.now(),
      };
      setMoves([...useGameStore.getState().moves, move]);
    });

    // 对手 pass
    socket.on('player_passed', (data: { player: 1 | 2; passCount: number }) => {
      setCurrentTurn(data.player === 1 ? 2 : 1);
      if (data.player !== useGameStore.getState().myColor) {
        setServerError(`对手停一手（连续 ${data.passCount} 次）`);
        setTimeout(() => setServerError(''), 3000);
      }
    });

    // 进入数子阶段
    socket.on('enter_scoring', (data: { board: Board }) => {
      setStatus('scoring');
      setBoard(data.board);
      setDeadStones([]);
      setTerritoryMap(null);
      setMyConfirmed(false);
      setOpponentConfirmed(false);
    });

    // 死子标记更新
    socket.on('dead_stones_updated', (data: { deadStones: Point[]; scorePreview: ScoreResult }) => {
      setDeadStones(data.deadStones);
      setScorePreview(data.scorePreview);
      setMyConfirmed(false);
      setOpponentConfirmed(false);
    });

    // 对方确认
    socket.on('score_confirmed_by', (data: { player: 1 | 2 }) => {
      const myC = useGameStore.getState().myColor;
      if (data.player === myC) setMyConfirmed(true);
      else setOpponentConfirmed(true);
    });

    // 对方不同意数子
    socket.on('score_disputed', () => {
      setStatus('playing');
      setDeadStones([]);
      setTerritoryMap(null);
      setMyConfirmed(false);
      setOpponentConfirmed(false);
      setServerError('对方对死子有争议，继续下棋');
      setTimeout(() => setServerError(''), 3000);
    });

    // 悔棋请求
    socket.on('undo_requested', () => {
      setUndoRequested(true);
    });

    // 悔棋结果
    socket.on('undo_result', (data: {
      accepted: boolean; board?: Board; currentTurn?: 1 | 2; moveNumber?: number;
    }) => {
      setUndoRequested(false);
      if (data.accepted && data.board) {
        setBoard(data.board);
        setCurrentTurn(data.currentTurn!);
        setLastMove(null);
      }
    });

    // 游戏结束
    socket.on('game_over', (data: GameResult) => {
      setResult(data);
      setStatus('finished');
      setShowResult(true);
    });

    // 服务端错误
    socket.on('error', (data: { message: string }) => {
      setServerError(data.message);
      setTimeout(() => setServerError(''), 3000);
    });

    return () => { socket.disconnect(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── 操作处理 ─────────────────────────────────────────────────
  const emit = useCallback((event: string, data?: object) => {
    socketRef.current?.emit(event, { code, ...data });
  }, [code]);

  const handlePlace = (x: number, y: number) => emit('place_stone', { x, y });
  const handlePass = () => emit('pass');
  const handleResign = () => { if (confirm('确认认输？')) emit('resign'); };
  const handleRequestUndo = () => emit('request_undo');
  const handleRespondUndo = (accept: boolean) => {
    emit('respond_undo', { accept });
    setUndoRequested(false);
  };
  const handleToggleDead = (x: number, y: number) => {
    if (board[y]?.[x] === 0) return;
    const key = `${x},${y}`;
    const exists = deadStones.some(([dx, dy]) => dx === x && dy === y);
    const newDead = exists
      ? deadStones.filter(([dx, dy]) => !(dx === x && dy === y))
      : [...deadStones, [x, y] as Point];
    emit('mark_dead', { stones: newDead });
  };
  const handleConfirmScore = () => emit('confirm_score');
  const handleDisputeScore = () => emit('dispute_score');

  // ── 复盘 ─────────────────────────────────────────────────────
  const replaySnapshots = useMemo(
    () => (replayMode ? buildReplaySnapshots(boardSize, moves) : null),
    [replayMode, boardSize, moves],
  );
  const replaySnap = replaySnapshots?.[replayIndex] ?? null;
  const currentReplayMove = replayMode && replayIndex > 0 ? moves[replayIndex - 1] : null;
  const replayLabel = formatMoveLabel(currentReplayMove, boardSize);
  const replayMoveLabel =
    replaySnap?.lastMove && currentReplayMove
      ? { x: replaySnap.lastMove[0], y: replaySnap.lastMove[1], n: replayIndex }
      : null;

  useEffect(() => {
    if (replayPlaying && replayIndex >= moves.length) setReplayPlaying(false);
  }, [replayPlaying, replayIndex, moves.length]);

  // ── UI 辅助 ──────────────────────────────────────────────────
  const myTurn = status === 'playing' && currentTurn === myColor;
  const colorLabel = myColor === 1 ? '●黑' : '○白';
  const opponentColorLabel = myColor === 1 ? '○白' : '●黑';

  const playerLabel = (color: 1 | 2, name: string) => (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
      currentTurn === color && status === 'playing'
        ? 'bg-amber-500/20 border border-amber-500'
        : 'bg-gray-800'
    }`}>
      <span className={`w-5 h-5 rounded-full border-2 ${color === 1 ? 'bg-gray-900 border-gray-400' : 'bg-white border-gray-300'}`} />
      <span className="font-medium">{name}</span>
      {currentTurn === color && status === 'playing' && (
        <span className="text-amber-400 text-xs animate-pulse">落子中</span>
      )}
    </div>
  );

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4 gap-4">
      {/* 顶部信息栏 */}
      <div className="w-full max-w-5xl flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-gray-400 text-sm">房间：</span>
          <span className="font-mono font-bold text-amber-400 tracking-widest">{code}</span>
        </div>
        <div className="text-sm text-gray-400">
          {status === 'waiting' && '等待对手加入...'}
          {status === 'playing' && (myTurn ? '轮到你落子' : '等待对手...')}
          {status === 'scoring' && '数子确认阶段'}
          {status === 'finished' && (replayMode ? '复盘回放中' : '对局结束')}
        </div>
        {status === 'finished' && replayMode ? (
          <button
            onClick={() => setShowResult(true)}
            className="text-sm text-amber-400 hover:text-amber-300"
          >
            查看结果
          </button>
        ) : (
          <div className="text-sm text-gray-400">你是 {colorLabel}</div>
        )}
      </div>

      {/* 主内容区 */}
      <div className="w-full max-w-5xl flex gap-4 items-start">
        {/* 左：棋盘 */}
        <div className="flex-1 flex flex-col gap-3">
          {/* 对手信息 */}
          {playerLabel(myColor === 1 ? 2 : 1, opponentNickname || '等待对手...')}

          {/* 棋盘 */}
          <GoBoard
            board={replaySnap ? replaySnap.board : board.length ? board : createEmptyBoard(boardSize)}
            boardSize={boardSize}
            lastMove={replaySnap ? replaySnap.lastMove : lastMove}
            deadStones={replayMode ? [] : deadStones}
            territoryMap={replayMode ? undefined : territoryMap ?? undefined}
            influenceMap={!replayMode && showInfluence && board.length ? estimateInfluence(board).heatmap : undefined}
            moveLabel={replayMode ? replayMoveLabel : undefined}
            myTurn={replayMode ? false : status === 'scoring' ? true : myTurn}
            onPlace={status === 'scoring' ? (x, y) => handleToggleDead(x, y) : handlePlace}
            disabled={replayMode || status === 'waiting' || status === 'finished'}
          />

          {/* 我的信息 */}
          {playerLabel(myColor ?? 1, myNickname || '我')}
        </div>

        {/* 右：手数记录 + 操作区 */}
        <div className="w-52 flex flex-col gap-4">
          <div className="h-80">
            <MoveList
              moves={moves}
              myColor={myColor ?? 1}
              currentIndex={replayMode ? replayIndex : undefined}
              onSelect={replayMode ? setReplayIndex : undefined}
            />
          </div>

          {/* 复盘控制 */}
          {replayMode && (
            <ReplayControls
              index={replayIndex}
              total={moves.length}
              label={replayLabel}
              playing={replayPlaying}
              onChange={(i) => { setReplayIndex(i); }}
              onTogglePlay={() => setReplayPlaying((v) => !v)}
              onExit={() => { setReplayPlaying(false); exitReplay(); }}
            />
          )}

          {/* 对局结束、非复盘态：复盘入口 */}
          {status === 'finished' && !replayMode && (
            <div className="space-y-2">
              {moves.length > 0 && (
                <button
                  onClick={enterReplay}
                  className="w-full py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-sm transition-colors"
                >
                  复盘本局
                </button>
              )}
              <button
                onClick={() => setShowResult(true)}
                className="w-full py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-sm transition-colors"
              >
                查看结果
              </button>
              <button
                onClick={() => router.push('/')}
                className="w-full py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-sm transition-colors"
              >
                返回首页
              </button>
            </div>
          )}

          {/* 操作按钮 */}
          {status === 'playing' && (
            <div className="space-y-2">
              <button
                onClick={() => setShowInfluence((v) => !v)}
                className={`w-full py-2 rounded-lg text-white text-sm transition-colors ${
                  showInfluence
                    ? 'bg-purple-600 hover:bg-purple-500'
                    : 'bg-purple-800 hover:bg-purple-700'
                }`}
              >
                {showInfluence ? '关闭形势' : '形势判断'}
              </button>
              {showInfluence && board.length > 0 && (() => {
                const inf = estimateInfluence(board);
                return (
                  <div className="text-xs space-y-1 text-gray-300 bg-gray-800 rounded-lg p-2">
                    <div className="flex justify-between">
                      <span>黑势</span><span>{inf.blackTerritory} 目</span>
                    </div>
                    <div className="flex justify-between">
                      <span>白势</span><span>{inf.whiteTerritory} 目</span>
                    </div>
                    <div className="w-full h-2 bg-gray-600 rounded overflow-hidden">
                      <div
                        className="h-full bg-gray-900"
                        style={{ width: `${(inf.blackRatio * 100).toFixed(1)}%` }}
                      />
                    </div>
                  </div>
                );
              })()}
              <button
                onClick={handlePass}
                disabled={!myTurn}
                className="w-full py-2 rounded-lg bg-yellow-700 hover:bg-yellow-600 text-white text-sm disabled:opacity-40 transition-colors"
              >
                停一手
              </button>
              <button
                onClick={handleRequestUndo}
                disabled={!myTurn || moves.length === 0}
                className="w-full py-2 rounded-lg bg-blue-700 hover:bg-blue-600 text-white text-sm disabled:opacity-40 transition-colors"
              >
                请求悔棋
              </button>
              <button
                onClick={handleResign}
                className="w-full py-2 rounded-lg bg-red-800 hover:bg-red-700 text-white text-sm transition-colors"
              >
                认输
              </button>
            </div>
          )}

          {/* 数子阶段操作 */}
          {status === 'scoring' && (
            <div className="bg-gray-800 rounded-xl p-4 space-y-3">
              <p className="text-xs text-gray-400">点击棋子标记死子</p>
              {scorePreview && (
                <div className="text-xs space-y-1 text-gray-300">
                  <div className="flex justify-between">
                    <span>黑棋</span><span>{scorePreview.blackScore.toFixed(1)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>白棋</span><span>{scorePreview.whiteScore.toFixed(1)}</span>
                  </div>
                </div>
              )}
              <button
                onClick={handleConfirmScore}
                disabled={myConfirmed}
                className="w-full py-2 rounded-lg bg-green-700 hover:bg-green-600 text-white text-sm disabled:opacity-40"
              >
                {myConfirmed ? '已确认 ✓' : '确认数子'}
              </button>
              {opponentConfirmed && !myConfirmed && (
                <p className="text-xs text-amber-400 text-center">对手已确认，等待你确认</p>
              )}
              <button
                onClick={handleDisputeScore}
                className="w-full py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-sm"
              >
                有争议，继续下棋
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 错误提示 */}
      {serverError && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-red-900 text-white px-6 py-3 rounded-xl shadow-lg text-sm">
          {serverError}
        </div>
      )}

      {/* 悔棋弹窗 */}
      {undoRequested && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-2xl p-8 space-y-4 text-center w-72">
            <h3 className="text-lg font-bold text-white">对手请求悔棋</h3>
            <p className="text-gray-400 text-sm">是否同意？</p>
            <div className="flex gap-3">
              <button
                onClick={() => handleRespondUndo(false)}
                className="flex-1 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white"
              >
                拒绝
              </button>
              <button
                onClick={() => handleRespondUndo(true)}
                className="flex-1 py-2 rounded-lg bg-green-700 hover:bg-green-600 text-white"
              >
                同意
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 结果弹窗 */}
      {showResult && result && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-2xl p-8 space-y-6 text-center w-80">
            <h2 className="text-2xl font-bold text-amber-400">
              {result.winner === myColor ? '🎉 你赢了！' : '对手获胜'}
            </h2>
            <div className="text-gray-300">
              {result.reason === 'resign' ? (
                <p>对方认输</p>
              ) : result.score ? (
                <div className="space-y-2">
                  <p className="text-amber-300 font-bold text-lg">
                    {result.winner === 1 ? '黑' : '白'}胜 {result.margin} 子
                  </p>
                  <table className="w-full text-sm text-left">
                    <thead><tr className="text-gray-500"><th>项目</th><th>黑</th><th>白</th></tr></thead>
                    <tbody>
                      <tr><td>活子</td><td>{result.score.blackStones}</td><td>{result.score.whiteStones}</td></tr>
                      <tr><td>领地</td><td>{result.score.blackTerritory}</td><td>{result.score.whiteTerritory}</td></tr>
                      <tr><td>贴目</td><td>-</td><td>{result.score.komi}</td></tr>
                      <tr className="font-bold text-amber-300">
                        <td>总分</td>
                        <td>{result.score.blackScore.toFixed(1)}</td>
                        <td>{result.score.whiteScore.toFixed(1)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              ) : null}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => router.push('/')}
                className="flex-1 py-3 rounded-xl bg-gray-700 hover:bg-gray-600 text-white font-bold"
              >
                返回首页
              </button>
              {moves.length > 0 && (
                <button
                  onClick={() => { enterReplay(); setShowResult(false); }}
                  className="flex-1 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold"
                >
                  复盘本局
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
