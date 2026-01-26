import type { NextApiRequest, NextApiResponse } from 'next';
import { Redis } from '@upstash/redis';

export interface LeaderboardEntry {
  walletAddress: string;
  username: string;
  credits: number;
  rank: number;
}

interface PlayerData {
  username: string;
  credits: number;
  spinsLeft: number;
  claimTime: number | null;
  walletAddress: string;
}

type Data = { leaderboard?: LeaderboardEntry[]; error?: string };

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
    console.error('[Leaderboard API] Missing Redis env vars:', { hasUrl: !!url, hasToken: !!token });
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

    if (req.method === 'GET') {
      const limit = parseInt((req.query.limit as string) || '10');
      
      // Get total count to calculate range for top N
      const totalCount = await redis.zcard('leaderboard:credits');
      
      if (totalCount === 0) {
        return res.status(200).json({ leaderboard: [] });
      }
      
      // Get top N players: from (total - limit) to total, then reverse
      // This gets the highest scores (they're at the end of the sorted set)
      const start = Math.max(0, totalCount - limit);
      const end = totalCount - 1;
      
      const members = await redis.zrange('leaderboard:credits', start, end);
      
      // Reverse to get highest first
      const reversedMembers = Array.isArray(members) ? [...members].reverse() : [];
      
      const leaderboard: LeaderboardEntry[] = [];

      if (reversedMembers.length > 0) {
        // Get scores and player data in parallel for better performance
        const promises = reversedMembers.map(async (member: string, index: number) => {
          const [score, player] = await Promise.all([
            redis.zscore('leaderboard:credits', member),
            redis.get<PlayerData>(`player:${member}`)
          ]);

          return {
            walletAddress: member,
            username: player?.username || `Player_${member.slice(0, 8)}`,
            credits: typeof score === 'number' ? score : Number(score) || 0,
            rank: index + 1,
          };
        });

        const results = await Promise.all(promises);
        leaderboard.push(...results);
      }

      return res.status(200).json({ leaderboard });
    }

    if (req.method === 'POST') {
      const { walletAddress, credits } = req.body || {};
      if (!walletAddress || credits === undefined) {
        return res.status(400).json({ error: 'walletAddress and credits required' });
      }

      await redis.zadd('leaderboard:credits', { score: credits, member: walletAddress });
      return res.status(200).json({ leaderboard: [] });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    console.error('[Leaderboard API] Error:', error);
    return res.status(500).json({ error: error?.message || 'Internal server error' });
  }
}