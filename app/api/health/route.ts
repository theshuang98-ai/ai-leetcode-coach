import { NextResponse } from 'next/server';
import { getHealthReport } from '@/lib/monitoring/health';

export async function GET() {
  const report = await getHealthReport();

  // 200 for 'ok' or 'degraded'; 503 only when the database is unreachable
  const httpStatus = report.status === 'error' ? 503 : 200;

  return NextResponse.json(report, { status: httpStatus });
}
