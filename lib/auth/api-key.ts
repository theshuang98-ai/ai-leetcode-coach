import crypto from 'node:crypto';
import { prisma } from '@/lib/prisma';

const API_KEY_BYTES = 16; // 32 hex characters
const KEY_PREFIX_LENGTH = 8;

/**
 * Generate a random 32-character hex API key.
 * Stores SHA-256 hash in DB; returns the raw key (shown once).
 */
export async function generateApiKey(
  userId: string,
  name?: string,
): Promise<string> {
  const rawKey = crypto.randomBytes(API_KEY_BYTES).toString('hex');
  const keyPrefix = rawKey.slice(0, KEY_PREFIX_LENGTH);
  const keyHash = hashApiKey(rawKey);

  await prisma.apiKey.create({
    data: {
      keyPrefix,
      keyHash,
      userId,
      name: name ?? null,
    },
  });

  return rawKey;
}

/**
 * Validate an API key against the database.
 * Returns the userId if valid, null otherwise.
 * Updates lastUsedAt on successful validation.
 */
export async function validateApiKey(key: string): Promise<string | null> {
  const keyHash = hashApiKey(key);

  const apiKey = await prisma.apiKey.findUnique({
    where: { keyHash },
    select: { id: true, userId: true },
  });

  if (!apiKey) return null;

  // Touch lastUsedAt (fire-and-forget)
  prisma.apiKey
    .update({
      where: { id: apiKey.id },
      data: { lastUsedAt: new Date() },
    })
    .catch(() => {
      /* non-critical */
    });

  return apiKey.userId;
}

/**
 * Hash an API key using SHA-256 for secure storage.
 */
export function hashApiKey(key: string): string {
  return crypto.createHash('sha256').update(key, 'utf8').digest('hex');
}

/**
 * List all API keys for a user (showing only keyPrefix, not full keys).
 */
export async function listUserApiKeys(userId: string) {
  return prisma.apiKey.findMany({
    where: { userId },
    select: {
      id: true,
      keyPrefix: true,
      name: true,
      lastUsedAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Delete an API key by ID (only if owned by userId).
 */
export async function deleteApiKey(
  keyId: string,
  userId: string,
): Promise<boolean> {
  const result = await prisma.apiKey.deleteMany({
    where: { id: keyId, userId },
  });
  return result.count > 0;
}
