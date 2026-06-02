import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '围棋对弈',
  description: '好友在线围棋对弈',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh">
      <body>{children}</body>
    </html>
  );
}
