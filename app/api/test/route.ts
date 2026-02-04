import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    anthropic_key_exists: !!process.env.ANTHROPIC_API_KEY,
    timestamp: new Date().toISOString(),
  });
}
