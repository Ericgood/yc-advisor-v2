'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Send, 
  Bot, 
  User, 
  Menu, 
  X, 
  Copy, 
  RotateCcw, 
  Trash2
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ErrorBoundary } from './ErrorBoundary';
import type { Message, Topic } from '@/lib/types';

// 在组件外部定义 Markdown 组件配置，避免每次渲染重复创建
const markdownComponents = {
  h1: ({children}: {children?: React.ReactNode}) => (
    <h1 className="text-xl font-bold text-gray-900 mt-4 mb-2">{children}</h1>
  ),
  h2: ({children}: {children?: React.ReactNode}) => (
    <h2 className="text-lg font-semibold text-gray-800 mt-3 mb-2">{children}</h2>
  ),
  h3: ({children}: {children?: React.ReactNode}) => (
    <h3 className="text-base font-medium text-gray-800 mt-2 mb-1">{children}</h3>
  ),
  strong: ({children}: {children?: React.ReactNode}) => (
    <strong className="font-semibold text-gray-900">{children}</strong>
  ),
  code: ({children}: {children?: React.ReactNode}) => (
    <code className="bg-gray-200 px-1 py-0.5 rounded text-sm text-orange-700">{children}</code>
  ),
  pre: ({children}: {children?: React.ReactNode}) => (
    <pre className="bg-gray-800 text-gray-100 p-3 rounded-lg overflow-x-auto my-2 text-sm">{children}</pre>
  ),
  ul: ({children}: {children?: React.ReactNode}) => (
    <ul className="list-disc pl-5 my-2 space-y-1">{children}</ul>
  ),
  ol: ({children}: {children?: React.ReactNode}) => (
    <ol className="list-decimal pl-5 my-2 space-y-1">{children}</ol>
  ),
  li: ({children}: {children?: React.ReactNode}) => (
    <li className="text-gray-700">{children}</li>
  ),
  p: ({children}: {children?: React.ReactNode}) => (
    <p className="mb-2 text-gray-700 leading-relaxed">{children}</p>
  ),
  blockquote: ({children}: {children?: React.ReactNode}) => (
    <blockquote className="border-l-4 border-orange-300 pl-4 italic text-gray-600 my-2">{children}</blockquote>
  ),
  a: ({href, children}: {href?: string; children?: React.ReactNode}) => (
    <a href={href} className="text-orange-600 hover:underline" target="_blank" rel="noopener noreferrer">{children}</a>
  ),
};

const remarkPlugins = [remarkGfm];

const TOPICS: Topic[] = [
  { id: 'idea', label: '💡 创业想法', prompt: '如何找到好的创业想法？' },
  { id: 'cofounder', label: '👥 联合创始人', prompt: '如何找到合适的联合创始人？' },
  { id: 'funding', label: '💰 融资策略', prompt: '什么时候该融资？' },
  { id: 'product', label: '🛠️ 产品开发', prompt: '如何实现产品市场匹配？' },
  { id: 'growth', label: '📈 增长获客', prompt: '如何获取前1000个用户？' },
  { id: 'hiring', label: '🎯 早期招聘', prompt: '早期招聘应该注意什么？' },
  { id: 'mindset', label: '🧠 创业心态', prompt: '如何保持创业动力？' },
];

// 欢迎消息常量，避免重复定义
const WELCOME_MESSAGE: Message = {
  id: 'welcome',
  role: 'assistant',
  content: `你好！我是 **YC Advisor**，你的创业咨询助手。

我基于 **Y Combinator** 的 443+ 个精选资源为你提供建议，包括：
- Paul Graham 的经典文章
- YC 合伙人的最新观点
- 成功创始人的实战经验

你可以问我任何关于创业的问题，或者点击下方的话题开始！`,
};

// 错误处理辅助函数
const handleChatError = (error: unknown): string => {
  if (error instanceof Error) {
    if (error.name === 'AbortError') {
      return '请求超时，请稍后重试';
    }
    return error.message;
  }
  return '发生未知错误';
};

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30秒超时

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          history: messages.slice(-6).map(m => ({ role: m.role, content: m.content })),
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `请求失败: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }

      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.text || '抱歉，没有收到回复。',
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch (err) {
      console.error('Chat error:', err);
      const errorMessage = handleChatError(err);
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'assistant',
        content: `抱歉，${errorMessage}。请稍后重试。`,
      }]);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, messages]);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    sendMessage(input);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 150) + 'px';
    }
  }, [input]);

  const copyMessage = async (content: string, id: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Failed to copy message:', err);
    }
  };

  const regenerate = useCallback(() => {
    // 找到最后一条用户消息的索引
    const lastUserIndex = messages.length - 1 - [...messages].reverse().findIndex(m => m.role === 'user');
    if (lastUserIndex >= 0) {
      const lastUser = messages[lastUserIndex];
      // 删除该用户消息之后的所有消息（通常是助手回复）
      setMessages(prev => prev.slice(0, lastUserIndex + 1));
      sendMessage(lastUser.content);
    }
  }, [messages, sendMessage]);

  const clearChat = useCallback(() => {
    if (confirm('确定清空对话？')) {
      setMessages([WELCOME_MESSAGE]);
    }
  }, []);

  return (
    <div className="flex h-screen bg-white">
      {/* 遮罩 */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/30 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* 侧边栏 */}
      <aside className={`${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 fixed lg:static inset-y-0 left-0 z-40 w-72 bg-gray-50 border-r border-gray-200 transition-transform flex flex-col`}>
        {/* Logo */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-500 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold">YC</span>
            </div>
            <div>
              <h1 className="font-bold text-gray-900">Advisor</h1>
              <p className="text-xs text-gray-500">创业咨询助手</p>
            </div>
          </div>
        </div>

        {/* 话题 */}
        <div className="flex-1 overflow-y-auto p-4">
          <p className="text-xs font-semibold text-gray-400 uppercase mb-3">热门话题</p>
          <div className="space-y-1">
            {TOPICS.map(topic => (
              <button
                key={topic.id}
                onClick={() => {
                  sendMessage(topic.prompt);
                  setSidebarOpen(false);
                }}
                className="w-full text-left px-3 py-2.5 text-sm text-gray-700 hover:bg-orange-100 hover:text-orange-700 rounded-lg transition-colors"
              >
                {topic.label}
              </button>
            ))}
          </div>
        </div>

        {/* 清空 */}
        <div className="p-4 border-t border-gray-200">
          <button
            onClick={clearChat}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            aria-label="清空所有对话"
          >
            <Trash2 size={16} />
            清空对话
          </button>
        </div>
      </aside>

      {/* 主区域 */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* 头部 */}
        <header className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white sticky top-0 z-20">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="lg:hidden p-2 hover:bg-gray-100 rounded-lg"
            aria-label={sidebarOpen ? '关闭侧边栏' : '打开侧边栏'}
            aria-expanded={sidebarOpen}
          >
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <h2 className="font-semibold text-gray-800">YC Advisor Chat</h2>
          <div className="w-10" />
        </header>

        {/* 消息 */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {messages.map((msg, idx) => (
            <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
              {/* 头像 */}
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${msg.role === 'user' ? 'bg-orange-100' : 'bg-orange-500'}`}>
                {msg.role === 'user' ? <User size={16} className="text-orange-600" /> : <Bot size={16} className="text-white" />}
              </div>

              {/* 内容 */}
              <div className="flex-1 max-w-3xl">
                <div className={`rounded-2xl px-4 py-3 ${msg.role === 'user' ? 'bg-orange-500 text-white ml-auto' : 'bg-gray-50 border border-gray-200'}`}>
                  {msg.role === 'user' ? (
                    <p className="whitespace-pre-wrap text-white">{msg.content}</p>
                  ) : (
                    <div className="prose prose-sm max-w-none text-gray-800">
                      <ErrorBoundary fallback={<p className="text-gray-500">消息渲染出错</p>}>
                        <ReactMarkdown
                          remarkPlugins={remarkPlugins}
                          components={markdownComponents}
                        >
                          {msg.content}
                        </ReactMarkdown>
                      </ErrorBoundary>
                    </div>
                  )}
                </div>

                {/* 操作按钮 */}
                {msg.role === 'assistant' && (
                  <div className="flex items-center gap-2 mt-1 opacity-0 hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => copyMessage(msg.content, msg.id)}
                      className="flex items-center gap-1 px-2 py-1 text-xs text-gray-500 hover:text-gray-700"
                      aria-label={copiedId === msg.id ? '已复制到剪贴板' : '复制消息'}
                    >
                      <Copy size={12} />
                      {copiedId === msg.id ? '已复制' : '复制'}
                    </button>
                    {idx === messages.length - 1 && !isLoading && (
                      <button
                        onClick={regenerate}
                        className="flex items-center gap-1 px-2 py-1 text-xs text-gray-500 hover:text-gray-700"
                        aria-label="重新生成回复"
                      >
                        <RotateCcw size={12} />
                        重新生成
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* 加载中 */}
          {isLoading && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center">
                <Bot size={16} className="text-white" />
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-orange-500 rounded-full animate-bounce" />
                  <span className="w-2 h-2 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                  <span className="w-2 h-2 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* 输入 */}
        <div className="border-t border-gray-200 p-4 bg-white">
          <form onSubmit={handleSubmit} className="max-w-4xl mx-auto">
            <div className="flex items-end gap-2 bg-gray-100 rounded-xl p-2 border border-gray-200 focus-within:border-orange-300 focus-within:ring-2 focus-within:ring-orange-100 transition-all">
              <label htmlFor="chat-input" className="sr-only">
                输入你的创业问题
              </label>
              <textarea
                id="chat-input"
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="输入你的创业问题..."
                aria-describedby="input-hint"
                rows={1}
                disabled={isLoading}
                className="flex-1 bg-transparent border-0 resize-none px-3 py-2 focus:outline-none text-gray-800 placeholder-gray-400 min-h-[44px] max-h-[150px]"
              />
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="p-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                aria-label="发送消息"
              >
                <Send size={18} />
              </button>
            </div>
            <p id="input-hint" className="text-xs text-gray-400 text-center mt-2">按 Enter 发送，Shift + Enter 换行</p>
          </form>
        </div>
      </main>
    </div>
  );
}
