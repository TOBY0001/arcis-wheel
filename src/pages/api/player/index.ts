import type { NextApiRequest, NextApiResponse } from 'next';
import { Redis } from '@upstash/redis';

export interface PlayerData {
  username: string;
  credits: number;
  spinsLeft: number;
  claimTime: number | null;
  walletAddress: string;
  lastSpinResetDate?: string; // UTC date string (YYYY-MM-DD)
}

/**
 * Get current UTC date string in YYYY-MM-DD format
 * This ensures spins reset at 12am UTC regardless of server timezone
 */
function getUTCDateString(): string {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const day = String(now.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

type Data = { player?: PlayerData; error?: string };

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

// Create Redis client lazily (inside handler) to ensure env vars are available
function getRedis(): Redis | null {
  const url = getRedisUrl();
  const token = getRedisToken();
  
  if (!url || !token) {
    console.error('[Player API] Missing Redis env vars:', { 
      hasUrl: !!url, 
      hasToken: !!token,
      availableVars: {
        UPSTASH_REDIS_REST_URL: !!process.env.UPSTASH_REDIS_REST_URL,
        KV_REST_API_URL: !!process.env.KV_REST_API_URL,
        REDIS_URL: !!process.env.REDIS_URL,
        UPSTASH_REDIS_REST_TOKEN: !!process.env.UPSTASH_REDIS_REST_TOKEN,
        KV_REST_API_TOKEN: !!process.env.KV_REST_API_TOKEN,
        REDIS_TOKEN: !!process.env.REDIS_TOKEN,
      }
    });
    return null;
  }
  
  return new Redis({ url, token });
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Data>
) {
  try {
    const redis = getRedis();
    
    if (!redis) {
      return res.status(500).json({ error: 'Redis not initialized - check environment variables' });
    }

    const wallet = (req.query.walletAddress || req.body?.walletAddress) as string;
    if (!wallet) {
      return res.status(400).json({ error: 'walletAddress required' });
    }

    const key = `player:${wallet}`;

    if (req.method === 'GET') {
      let player = await redis.get<PlayerData>(key);
      const todayUTC = getUTCDateString();

      if (!player) {
        player = {
          username: `Player_${wallet.slice(0, 8)}`,
          credits: 0,
          spinsLeft: 5,
          claimTime: null,
          walletAddress: wallet,
          lastSpinResetDate: todayUTC,
        };
        await redis.set(key, player);
        await redis.sadd('players:all', wallet);
      } else {
        // Check if we need to reset spins for a new UTC day
        // Reset happens at 12am UTC regardless of whether user finished their spins
        if (!player.lastSpinResetDate || player.lastSpinResetDate !== todayUTC) {
          player.spinsLeft = 5;
          player.lastSpinResetDate = todayUTC;
          await redis.set(key, player);
        }
      }

      return res.status(200).json({ player });
    }

    if (req.method === 'POST') {
      const updates = req.body || {};
      const todayUTC = getUTCDateString();
      
      const existing = (await redis.get<PlayerData>(key)) || {
        username: `Player_${wallet.slice(0, 8)}`,
        credits: 0,
        spinsLeft: 5,
        claimTime: null,
        walletAddress: wallet,
        lastSpinResetDate: todayUTC,
      };

      // Check if we need to reset spins for a new UTC day
      // Reset happens at 12am UTC regardless of whether user finished their spins
      const isNewDay = !existing.lastSpinResetDate || existing.lastSpinResetDate !== todayUTC;
      
      const updated: PlayerData = {
        ...existing,
        ...updates,
        walletAddress: wallet,
        lastSpinResetDate: todayUTC, // Always update to current UTC date
      };

      // If it's a new UTC day, reset spins to 5 regardless of what the client sent
      if (isNewDay) {
        updated.spinsLeft = 5;
        console.log(`[Player API] Reset spins for new UTC day: ${wallet}, date changed from ${existing.lastSpinResetDate} to ${todayUTC}`);
      }

      await redis.set(key, updated);
      await redis.sadd('players:all', wallet);

      if (updates.credits !== undefined && updated.credits >= 0) {
        await redis.zadd('leaderboard:credits', { score: updated.credits, member: wallet });
      }

      console.log(`[Player API] Saved: ${wallet}, credits=${updated.credits}, spinsLeft=${updated.spinsLeft}, lastResetDate=${updated.lastSpinResetDate}`);
      return res.status(200).json({ player: updated });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    console.error('[Player API] Error:', error);
    return res.status(500).json({ error: error?.message || 'Internal server error' });
  }
}
