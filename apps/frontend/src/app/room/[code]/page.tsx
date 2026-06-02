'use client';
import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { io, Socket } from 'socket.io-client';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3001';

export default function RoomPage() {
  const router = useRouter();
  const params = useParams();
  const code = (params.code as string).toUpperCase();
  const [copied, setCopied] = useState(false);
  const [waiting, setWaiting] = useState(true);

  useEffect(() => {
    const nickname = sessionStorage.getItem('nickname') || '玩家';
    const socket: Socket = io(`${WS_URL}/game`);

    socket.on('connect', () => {
      socket.emit('bind_room', { code });
    });

    socket.on('opponent_joined', () => {
      setWaiting(false);
      // 跳转到对弈页
      router.push(`/game/${code}?nickname=${encodeURIComponent(nickname)}`);
    });

    socket.on('error', (data: { message: string }) => {
      alert(`错误：${data.message}`);
    });

    return () => { socket.disconnect(); };
  }, [code, router]);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm text-center space-y-8">
        <h1 className="text-3xl font-bold text-amber-400">等待好友加入</h1>

        <div className="bg-gray-800 rounded-xl p-8 space-y-4">
          <p className="text-gray-400 text-sm">将邀请码发给好友</p>
          <div className="text-5xl font-mono font-bold tracking-widest text-white py-4 bg-gray-700 rounded-lg">
            {code}
          </div>
          <button
            onClick={handleCopy}
            className="w-full py-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-bold transition-colors"
          >
            {copied ? '已复制 ✓' : '复制邀请码'}
          </button>
        </div>

        {waiting && (
          <div className="flex items-center justify-center gap-3 text-gray-400">
            <div className="w-2 h-2 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-2 h-2 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-2 h-2 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: '300ms' }} />
            <span className="text-sm">等待好友加入...</span>
          </div>
        )}

        <button
          onClick={() => router.push('/')}
          className="text-gray-500 hover:text-gray-300 text-sm transition-colors"
        >
          取消，返回首页
        </button>
      </div>
    </main>
  );
}
