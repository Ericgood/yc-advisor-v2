import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    openrouter_key_exists: !!process.env.OPENROUTER_API_KEY,
    openrouter_key_length: process.env.OPENROUTER_API_KEY?.length,
    timestamp: new Date().toISOString(),
  });
}
