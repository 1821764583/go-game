/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@go-game/engine'],
  output: 'standalone',
};

module.exports = nextConfig;
