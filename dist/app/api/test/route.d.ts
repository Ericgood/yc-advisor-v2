import { NextResponse } from 'next/server';
export declare function GET(): Promise<NextResponse<{
    status: string;
    openrouter_key_exists: boolean;
    openrouter_key_length: number | undefined;
    timestamp: string;
}>>;
//# sourceMappingURL=route.d.ts.map