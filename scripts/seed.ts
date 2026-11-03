#!/usr/bin/env tsx
/**
 * Database seed convenience wrapper.
 *
 * Delegates to prisma/seed.ts for actual seeding logic.
 * Run via: npm run db:seed   (or)   npx tsx scripts/seed.ts
 */
import '../prisma/seed';
