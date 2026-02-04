'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Menu, X, Copy, RotateCcw, Trash2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

const TOPICS = [
  { id: 'idea', label: '💡 创业想法', prompt: '如何找到好的创业想法？' },
  { id: 'cofounder', label: '👥 联合创始人', prompt: '如何找到合适的联合创始人？' },
  { id: 'funding', label: '💰 融资', prompt: '什么时候该融资？' },
  { id: 'product', label: '🛠️ 产品', prompt: '如何实现产品市场匹配？' },
  { id: 'growth', label: '📈 增长', prompt: '如何获取前1000个用户？' },
  { id: 'hiring', label: '🎯 招聘', prompt: '早期招聘应该注意什么？' },
  { id: 'mindset', label: '🧠 心态', prompt: '如何保持创业动力？' },
];

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: `你好！我是 **YC Advisor**，你的创业咨询助手。

我基于 **Y Combinator** 的 443+ 个精选资源为你提供建议。

你可以问我任何关于创业的问题，或者点击下方的话题开始！`,
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 自动滚动
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 发送消息
  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    // 重置输入框高度
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          history: messages.slice(-6).map(m => ({ role: m.role, content: m.content })),
        }),
      });

      if (!response.ok) {
        throw new Error('API Error');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let content = '';

      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '',
      };
      setMessages(prev => [...prev, assistantMsg]);

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;
            
            try {
              const parsed = JSON.parse(data);
              if (parsed.text) {
                content += parsed.text;
                setMessages(prev => {
                  const newMessages = [...prev];
                  newMessages[newMessages.length - 1].content = content;
                  return newMessages;
                });
              }
            } catch {
              // ignore
            }
          }
        }
      }
    } catch {
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'assistant',
        content: '抱歉，出现了错误。请稍后重试。',
      }]);
    } finally {
      setIsLoading(false);
    }
  };

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

  // 调整文本框高度
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 150) + 'px';
    }
  }, [input]);

  // 复制
  const copyMessage = async (content: string, id: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // ignore
    }
  };

  // 重新生成
  const regenerate = () => {
    const lastUser = [...messages].reverse().find(m => m.role === 'user');
    if (lastUser) {
      setMessages(prev => prev.slice(0, -1));
      sendMessage(lastUser.content);
    }
  };

  // 清空
  const clearChat = () => {
    if (confirm('确定清空对话？')) {
      setMessages([{
        id: 'welcome',
        role: 'assistant',
        content: `你好！我是 **YC Advisor**，你的创业咨询助手。

我基于 **Y Combinator** 的 443+ 个精选资源为你提供建议。

你可以问我任何关于创业的问题，或者点击下方的话题开始！`,
      }]);
    }
  };

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
          <p className="text-xs font-semibold text-gray-400 uppercase mb-3">话题分类</p>
          <div className="space-y-1">
            {TOPICS.map(topic => (
              <button
                key={topic.id}
                onClick={() => {
                  sendMessage(topic.prompt);
                  setSidebarOpen(false);
                }}
                className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-orange-100 hover:text-orange-700 rounded-lg transition-colors"
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
          >
            <Trash2 size={16} />
            清空对话
          </button>
        </div>
      </aside>

      {/* 主区域 */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* 头部 */}
        <header className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="lg:hidden p-2 hover:bg-gray-100 rounded-lg"
          >
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <h2 className="font-semibold text-gray-800">YC Advisor Chat</h2>
          <div className="w-10" />
        </header>

        {/* 消息 */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg, idx) => (
            <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
              {/* 头像 */}
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${msg.role === 'user' ? 'bg-gray-200' : 'bg-orange-500'}`}>
                {msg.role === 'user' ? <User size={16} className="text-gray-600" /> : <Bot size={16} className="text-white" />}
              </div>

              {/* 内容 */}
              <div className="flex-1 max-w-3xl">
                <div className={`rounded-2xl px-4 py-3 ${msg.role === 'user' ? 'bg-orange-500 text-white ml-auto' : 'bg-gray-100 text-gray-800'}`}>
                  {msg.role === 'user' ? (
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  ) : (
                    <div className="prose prose-sm max-w-none prose-headings:text-gray-800 prose-p:text-gray-700 prose-strong:text-gray-900 prose-code:text-orange-600 prose-pre:bg-gray-800 prose-pre:text-gray-100">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {msg.content}
                      </ReactMarkdown>
                    </div>
                  )}
                </div>

                {/* 操作按钮 */}
                {msg.role === 'assistant' && (
                  <div className="flex items-center gap-2 mt-1 opacity-0 hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => copyMessage(msg.content, msg.id)}
                      className="flex items-center gap-1 px-2 py-1 text-xs text-gray-500 hover:text-gray-700"
                    >
                      <Copy size={12} />
                      {copiedId === msg.id ? '已复制' : '复制'}
                    </button>
                    {idx === messages.length - 1 && (
                      <button
                        onClick={regenerate}
                        className="flex items-center gap-1 px-2 py-1 text-xs text-gray-500 hover:text-gray-700"
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
              <div className="bg-gray-100 rounded-2xl px-4 py-3">
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
            <div className="flex items-end gap-2 bg-gray-100 rounded-xl p-2 border border-gray-200 focus-within:border-orange-300 focus-within:ring-2 focus-within:ring-orange-100">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="输入你的创业问题..."
                rows={1}
                disabled={isLoading}
                className="flex-1 bg-transparent border-0 resize-none px-3 py-2 focus:outline-none text-gray-800 placeholder-gray-400 min-h-[44px] max-h-[150px]"
              />
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="p-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Send size={18} />
              </button>
            </div>
            <p className="text-xs text-gray-400 text-center mt-2">按 Enter 发送，Shift + Enter 换行</p>
          </form>
        </div>
      </main>
    </div>
  );
}
