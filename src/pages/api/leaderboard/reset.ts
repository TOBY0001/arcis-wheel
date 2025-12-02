import type { NextApiRequest, NextApiResponse } from 'next';
import { Redis } from '@upstash/redis';

// Helper to get Redis URL from various possible env var names
function getRedisUrl(): string | null {
  return (
    process.env.UPSTASH_REDIS_REST_URL ||
    process.env.KV_REST_API_URL ||
    process.env.REDIS_URL ||
    process.env.KV_URL ||
    null
  );
}

// Helper to get Redis Token from various possible env var names
function getRedisToken(): string | null {
  return (
    process.env.UPSTASH_REDIS_REST_TOKEN ||
    process.env.KV_REST_API_TOKEN ||
    process.env.KV_REST_API_READ_ONLY_TOKEN ||
    process.env.REDIS_TOKEN ||
    process.env.KV_REST_ADT_TOKEN ||
    null
  );
}

// Create Redis client lazily
function getRedis(): Redis | null {
  const url = getRedisUrl();
  const token = getRedisToken();
  
  if (!url || !token) {
    console.error('[Leaderboard Reset] Missing Redis env vars');
    return null;
  }
  
  return new Redis({ url, token });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const redis = getRedis();
    if (!redis) {
      return res.status(500).json({ error: 'Redis not initialized' });
    }

    const apiKey = req.headers['x-api-key'];
    if (process.env.LEADERBOARD_RESET_API_KEY && apiKey !== process.env.LEADERBOARD_RESET_API_KEY) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    await redis.del('leaderboard:credits');
    console.log('[Leaderboard Reset] Cleared at', new Date().toISOString());

    return res.status(200).json({ success: true, message: 'Leaderboard reset' });
  } catch (error: any) {
    console.error('[Leaderboard Reset] Error:', error);
    return res.status(500).json({ error: error?.message || 'Internal server error' });
  }
}
