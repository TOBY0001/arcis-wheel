const webpack = require('webpack');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
  
  // Performance optimizations
  experimental: {
    optimizePackageImports: ['@solana/web3.js', '@solana/wallet-adapter-react-ui'],
  },
  
  // Reduce bundle size
  swcMinify: true,
  
  // Optimize webpack
  webpack: (config, { isServer, dev }) => {
    // Only apply polyfills on client side
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        'crypto': require.resolve('crypto-browserify'),
        'stream': require.resolve('stream-browserify'),
        'buffer': require.resolve('buffer/'),
        'fs': false,
        'path': false,
        'os': false,
        'create-hash': false,
        'end-of-stream': false,
        'once': false,
        'pump': false,
        'object-keys': false
      };
    }

    // Add buffer polyfill (only for client-side)
    if (!isServer) {
      config.plugins.push(
        new webpack.ProvidePlugin({
          Buffer: ['buffer', 'Buffer'],
          process: 'process/browser',
        })
      );
    } else {
      // For server-side, only add Buffer polyfill, don't override process
      config.plugins.push(
        new webpack.ProvidePlugin({
          Buffer: ['buffer', 'Buffer'],
        })
      );
    }

    // Optimize for development
    if (dev) {
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          chunks: 'all',
          cacheGroups: {
            solana: {
              test: /[\\/]node_modules[\\/]@solana[\\/]/,
              name: 'solana',
              chunks: 'all',
            },
            arcium: {
              test: /[\\/]node_modules[\\/]@arcium-hq[\\/]/,
              name: 'arcium',
              chunks: 'all',
            },
          },
        },
      };
    }

    return config;
  }
};

module.exports = nextConfig;
