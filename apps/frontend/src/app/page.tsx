'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

export default function HomePage() {
  const router = useRouter();
  const [nickname, setNickname] = useState('');
  const [boardSize, setBoardSize] = useState<9 | 13 | 19>(19);
  const [joinCode, setJoinCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCreate = async () => {
    if (!nickname.trim()) return setError('请输入昵称');
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${BACKEND}/api/room/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ boardSize, nickname: nickname.trim() }),
      });
      if (!res.ok) throw new Error('创建失败');
      const data = await res.json();
      // 把昵称存 sessionStorage，供对弈页使用
      sessionStorage.setItem('nickname', nickname.trim());
      sessionStorage.setItem('color', '1');
      router.push(`/room/${data.code}`);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!nickname.trim()) return setError('请输入昵称');
    if (!joinCode.trim()) return setError('请输入邀请码');
    const code = joinCode.trim().toUpperCase();
    // 校验房间存在
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${BACKEND}/api/room/${code}`);
      if (!res.ok) throw new Error('房间不存在或已过期');
      const data = await res.json();
      if (data.status !== 'waiting') throw new Error('房间已满，对局已开始');
      sessionStorage.setItem('nickname', nickname.trim());
      sessionStorage.setItem('color', '2');
      router.push(`/game/${code}?nickname=${encodeURIComponent(nickname.trim())}&join=1`);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-amber-400 mb-2">围棋对弈</h1>
          <p className="text-gray-400">与好友在线对局</p>
        </div>

        {/* 昵称 */}
        <div>
          <label className="block text-sm text-gray-400 mb-1">你的昵称</label>
          <input
            className="w-full px-4 py-2 rounded-lg bg-gray-800 border border-gray-600 text-white focus:outline-none focus:border-amber-400"
            placeholder="输入昵称（最多12字）"
            maxLength={12}
            value={nickname}
            onChange={e => setNickname(e.target.value)}
          />
        </div>

        {/* 创建房间 */}
        <div className="bg-gray-800 rounded-xl p-6 space-y-4">
          <h2 className="text-lg font-semibold text-amber-300">创建房间</h2>
          <div className="flex gap-2">
            {([9, 13, 19] as const).map(s => (
              <button
                key={s}
                onClick={() => setBoardSize(s)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                  boardSize === s
                    ? 'bg-amber-500 text-black'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {s}路棋盘
              </button>
            ))}
          </div>
          <button
            onClick={handleCreate}
            disabled={loading}
            className="w-full py-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-bold transition-colors disabled:opacity-50"
          >
            {loading ? '创建中...' : '创建房间'}
          </button>
        </div>

        {/* 加入房间 */}
        <div className="bg-gray-800 rounded-xl p-6 space-y-4">
          <h2 className="text-lg font-semibold text-amber-300">加入房间</h2>
          <input
            className="w-full px-4 py-2 rounded-lg bg-gray-700 border border-gray-600 text-white uppercase tracking-widest text-center text-xl focus:outline-none focus:border-amber-400"
            placeholder="输入邀请码"
            maxLength={6}
            value={joinCode}
            onChange={e => setJoinCode(e.target.value.toUpperCase())}
          />
          <button
            onClick={handleJoin}
            disabled={loading}
            className="w-full py-3 rounded-lg bg-green-600 hover:bg-green-500 text-white font-bold transition-colors disabled:opacity-50"
          >
            {loading ? '加入中...' : '加入房间'}
          </button>
        </div>

        {error && (
          <p className="text-center text-red-400 text-sm">{error}</p>
        )}
      </div>
    </main>
  );
}
