export interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
}
export interface ChatRequest {
    message: string;
    history?: ChatMessage[];
}
export interface ChatResponse {
    text?: string;
    error?: string;
    details?: string;
}
export interface ValidationResult<T = unknown> {
    valid: boolean;
    error?: string;
    data?: T;
}
export interface RateLimitRecord {
    count: number;
    resetTime: number;
}
export interface RateLimitResult {
    allowed: boolean;
    retryAfter?: number;
    remaining?: number;
}
export interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
}
export interface Topic {
    id: string;
    label: string;
    prompt: string;
}
export type ApiResponse<T = unknown> = {
    success: true;
    data: T;
} | {
    success: false;
    error: string;
    details?: string;
};
export declare function successResponse<T>(data: T): ApiResponse<T>;
export declare function errorResponse(error: string, details?: string): ApiResponse<never>;
export declare class AppError extends Error {
    code: string;
    statusCode: number;
    details?: string | undefined;
    constructor(message: string, code: string, statusCode?: number, details?: string | undefined);
}
export declare enum ErrorCode {
    INVALID_REQUEST = "INVALID_REQUEST",
    RATE_LIMITED = "RATE_LIMITED",
    SERVICE_ERROR = "SERVICE_ERROR",
    TIMEOUT = "TIMEOUT",
    UNAUTHORIZED = "UNAUTHORIZED",
    NOT_FOUND = "NOT_FOUND"
}
//# sourceMappingURL=types.d.ts.map