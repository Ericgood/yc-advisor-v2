/**
 * YC Advisor 统一类型定义
 */

// ==================== API 类型 ====================

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

// ==================== 限流类型 ====================

export interface RateLimitRecord {
  count: number;
  resetTime: number;
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfter?: number;
  remaining?: number;
}

// ==================== 组件类型 ====================

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  resources?: { code: string; title: string; author: string }[];
}

export interface Topic {
  id: string;
  label: string;
  prompt: string;
}

// ==================== API 响应标准化 ====================

export type ApiResponse<T = unknown> = 
  | { success: true; data: T }
  | { success: false; error: string; details?: string };

export function successResponse<T>(data: T): ApiResponse<T> {
  return { success: true, data };
}

export function errorResponse(error: string, details?: string): ApiResponse<never> {
  return { success: false, error, ...(details && { details }) };
}

// ==================== 错误类型 ====================

export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public details?: string
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export enum ErrorCode {
  INVALID_REQUEST = 'INVALID_REQUEST',
  RATE_LIMITED = 'RATE_LIMITED',
  SERVICE_ERROR = 'SERVICE_ERROR',
  TIMEOUT = 'TIMEOUT',
  UNAUTHORIZED = 'UNAUTHORIZED',
  NOT_FOUND = 'NOT_FOUND',
}
