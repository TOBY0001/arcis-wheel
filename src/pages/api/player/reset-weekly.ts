import type { NextApiRequest, NextApiResponse } from 'next';
import { Redis } from '@upstash/redis';

function getWeekNumber(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(date.getFullYear(), 0, 1));
  return Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

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
    console.error('[Weekly Reset] Missing Redis env vars');
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
    if (process.env.WEEKLY_RESET_API_KEY && apiKey !== process.env.WEEKLY_RESET_API_KEY) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const currentWeek = getWeekNumber(new Date());
    const lastWeek = await redis.get<number>('system:lastResetWeek');

    if (lastWeek === currentWeek) {
      return res.status(200).json({ success: true, message: 'Already reset this week' });
    }

    const players = await redis.smembers('players:all');
    let count = 0;

    for (const wallet of players || []) {
      try {
        const player = await redis.get<any>(`player:${wallet}`);
        if (player) {
          player.credits = 0;
          await redis.set(`player:${wallet}`, player);
          count++;
        }
      } catch (error) {
        console.error(`[Weekly Reset] Error resetting ${wallet}:`, error);
      }
    }

    await redis.del('leaderboard:credits');
    await redis.set('system:lastResetWeek', currentWeek);

    console.log(`[Weekly Reset] Reset ${count} players`);
    return res.status(200).json({ success: true, message: `Reset ${count} players` });
  } catch (error: any) {
    console.error('[Weekly Reset] Error:', error);
    return res.status(500).json({ error: error?.message || 'Internal server error' });
  }
}
