'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Send, 
  Bot, 
  User, 
  Sparkles, 
  Lightbulb, 
  Users, 
  TrendingUp, 
  Briefcase, 
  Heart, 
  Menu, 
  X,
  Copy,
  RotateCcw,
  Square,
  Trash2,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  isError?: boolean;
}

interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  timestamp: number;
}

const TOPICS = [
  { id: 'idea', label: '创业想法', icon: Lightbulb, prompt: '如何找到好的创业想法？' },
  { id: 'cofounder', label: '联合创始人', icon: Users, prompt: '如何找到合适的联合创始人？' },
  { id: 'funding', label: '融资', icon: TrendingUp, prompt: '什么时候该融资？' },
  { id: 'product', label: '产品', icon: Sparkles, prompt: '如何实现产品市场匹配？' },
  { id: 'growth', label: '增长', icon: TrendingUp, prompt: '如何获取前1000个用户？' },
  { id: 'hiring', label: '招聘', icon: Briefcase, prompt: '早期招聘应该注意什么？' },
  { id: 'mindset', label: '心态', icon: Heart, prompt: '如何保持创业动力？' },
];

const STORAGE_KEY = 'yc-advisor-chats';
const CURRENT_CHAT_KEY = 'yc-advisor-current';

// 生成唯一ID
const generateId = () => Math.random().toString(36).substring(2, 15);

// 获取对话标题
const getChatTitle = (messages: Message[]): string => {
  const firstUserMessage = messages.find(m => m.role === 'user');
  if (firstUserMessage) {
    return firstUserMessage.content.slice(0, 30) + (firstUserMessage.content.length > 30 ? '...' : '');
  }
  return '新对话';
};

export default function Chat() {
  // 对话状态
  const [messages, setMessages] = useState<Message[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(CURRENT_CHAT_KEY);
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch {
          return getInitialMessages();
        }
      }
    }
    return getInitialMessages();
  });
  
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // 获取初始消息
  function getInitialMessages(): Message[] {
    return [
      {
        id: generateId(),
        role: 'assistant',
        content: '你好！我是 **YC Advisor**，你的创业咨询助手。\n\n我基于 **Y Combinator** 的 443+ 个精选资源为你提供建议。\n\n你可以问我任何关于创业的问题，或者点击下方的话题开始！',
        timestamp: Date.now(),
      },
    ];
  }

  // 加载历史对话
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        setChatSessions(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to load chat history:', e);
      }
    }
  }, []);

  // 保存当前对话
  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem(CURRENT_CHAT_KEY, JSON.stringify(messages));
    }
  }, [messages]);

  // 自动滚动
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // 页面加载后自动聚焦输入框
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  // 点击外部关闭侧边栏
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (sidebarOpen && chatContainerRef.current && !chatContainerRef.current.contains(e.target as Node)) {
        setSidebarOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [sidebarOpen]);

  // 保存对话到历史
  const saveChatToHistory = useCallback(() => {
    if (messages.length <= 1) return; // 只有欢迎消息不保存
    
    const newSession: ChatSession = {
      id: generateId(),
      title: getChatTitle(messages),
      messages: [...messages],
      timestamp: Date.now(),
    };
    
    setChatSessions(prev => {
      const updated = [newSession, ...prev].slice(0, 20); // 最多保存20个
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  }, [messages]);

  // 发送消息
  const handleSubmit = async (overrideInput?: string) => {
    const textToSend = overrideInput || input.trim();
    if (!textToSend || isLoading) return;

    const userMessage: Message = {
      id: generateId(),
      role: 'user',
      content: textToSend,
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setErrorMessage(null);

    // 重置输入框高度
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    try {
      abortControllerRef.current = new AbortController();
      
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: textToSend,
          history: messages.slice(-10).map(m => ({ role: m.role, content: m.content })), // 只保留最近10条上下文
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const assistantMessage: Message = {
        id: generateId(),
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
      };
      
      setMessages(prev => [...prev, assistantMessage]);

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';

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
                fullContent += parsed.text;
                setMessages(prev => {
                  const newMessages = [...prev];
                  const lastMessage = newMessages[newMessages.length - 1];
                  if (lastMessage.role === 'assistant') {
                    lastMessage.content = fullContent;
                  }
                  return newMessages;
                });
              }
            } catch {
              // Ignore parse errors
            }
          }
        }
      }

      // 成功完成后保存对话
      setTimeout(saveChatToHistory, 1000);
      
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }
      
      console.error('Chat error:', error);
      const errorMsg = '抱歉，出现了错误。请稍后重试。';
      setErrorMessage(errorMsg);
      setMessages(prev => [
        ...prev,
        {
          id: generateId(),
          role: 'assistant',
          content: errorMsg,
          timestamp: Date.now(),
          isError: true,
        },
      ]);
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  // 取消请求
  const handleCancel = () => {
    abortControllerRef.current?.abort();
    setIsLoading(false);
  };

  // 键盘事件
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
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [input]);

  // 复制消息
  const handleCopy = async (content: string, id: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // 重新生成
  const handleRegenerate = () => {
    const lastUserMessage = [...messages].reverse().find(m => m.role === 'user');
    if (lastUserMessage) {
      // 删除最后一条助手回复
      setMessages(prev => prev.slice(0, -1));
      handleSubmit(lastUserMessage.content);
    }
  };

  // 清空对话
  const handleClear = () => {
    if (confirm('确定要清空当前对话吗？')) {
      saveChatToHistory();
      const initial = getInitialMessages();
      setMessages(initial);
      localStorage.setItem(CURRENT_CHAT_KEY, JSON.stringify(initial));
      textareaRef.current?.focus();
    }
  };

  // 加载历史对话
  const loadSession = (session: ChatSession) => {
    setMessages(session.messages);
    setShowHistory(false);
    setSidebarOpen(false);
    textareaRef.current?.focus();
  };

  // 新建对话
  const handleNewChat = () => {
    saveChatToHistory();
    const initial = getInitialMessages();
    setMessages(initial);
    localStorage.setItem(CURRENT_CHAT_KEY, JSON.stringify(initial));
    setShowHistory(false);
    textareaRef.current?.focus();
  };

  // 删除历史对话
  const deleteSession = (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    setChatSessions(prev => {
      const updated = prev.filter(s => s.id !== sessionId);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  };

  return (
    <div className="flex h-screen bg-gray-50" ref={chatContainerRef}>
      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0 fixed lg:static inset-y-0 left-0 z-40 w-80 bg-white border-r border-gray-200 transition-transform duration-200 ease-in-out flex flex-col`}
      >
        {/* Header */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-10 h-10 bg-orange-500 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">YC</span>
            </div>
            <div>
              <h1 className="font-bold text-lg">Advisor</h1>
              <p className="text-xs text-gray-500">YC 创业咨询助手</p>
            </div>
          </div>
          
          <button
            onClick={handleNewChat}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
          >
            <Sparkles size={16} />
            新对话
          </button>
        </div>

        {/* History Toggle */}
        <div className="px-4 py-2 border-b border-gray-100">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="flex items-center justify-between w-full text-sm font-medium text-gray-700"
          >
            <span>历史对话</span>
            {showHistory ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>

        {/* History List */}
        {showHistory && (
          <div className="flex-1 overflow-y-auto p-2 space-y-1 max-h-48">
            {chatSessions.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4">暂无历史对话</p>
            ) : (
              chatSessions.map(session => (
                <div
                  key={session.id}
                  onClick={() => loadSession(session)}
                  className="group flex items-center justify-between p-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg cursor-pointer"
                >
                  <span className="truncate flex-1">{session.title}</span>
                  <button
                    onClick={(e) => deleteSession(e, session.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-500 transition-opacity"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {/* Topics */}
        <div className="flex-1 overflow-y-auto p-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            话题分类
          </p>
          <nav className="space-y-1">
            {TOPICS.map((topic) => {
              const Icon = topic.icon;
              return (
                <button
                  key={topic.id}
                  onClick={() => {
                    handleSubmit(topic.prompt);
                    setSidebarOpen(false);
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-700 hover:bg-orange-50 hover:text-orange-600 rounded-lg transition-colors"
                >
                  <Icon size={18} className="text-orange-500" />
                  {topic.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200">
          <button
            onClick={handleClear}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm text-gray-600 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
          >
            <Trash2 size={16} />
            清空当前对话
          </button>
        </div>
      </aside>

      {/* Main Chat Area */}
      <main className="flex-1 flex flex-col min-w-0 bg-white">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between sticky top-0 z-20">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="lg:hidden p-2 hover:bg-gray-100 rounded-lg"
          >
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <h2 className="font-semibold text-gray-800 lg:absolute lg:left-1/2 lg:-translate-x-1/2">
            YC Advisor
          </h2>
          <div className="w-10" /> {/* Spacer */}
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {messages.map((message, index) => (
            <div
              key={message.id}
              className={`flex gap-4 ${
                message.role === 'user' ? 'flex-row-reverse' : ''
              }`}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  message.role === 'user'
                    ? 'bg-gray-200'
                    : 'bg-orange-500'
                }`}
              >
                {message.role === 'user' ? (
                  <User size={16} className="text-gray-600" />
                ) : (
                  <Bot size={16} className="text-white" />
                )}
              </div>
              <div className="flex-1 max-w-3xl">
                <div
                  className={`rounded-2xl px-4 py-3 ${
                    message.role === 'user'
                      ? 'bg-orange-500 text-white ml-auto'
                      : message.isError
                      ? 'bg-red-50 border border-red-200 text-red-700'
                      : 'bg-gray-100'
                  }`}
                >
                  {message.role === 'user' ? (
                    <p className="whitespace-pre-wrap">{message.content}</p>
                  ) : (
                    <div className="prose prose-sm max-w-none">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {message.content}
                      </ReactMarkdown>
                    </div>
                  )}
                </div>
                
                {/* Message Actions */}
                {message.role === 'assistant' && !message.isError && (
                  <div className="flex items-center gap-2 mt-2 opacity-0 hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleCopy(message.content, message.id)}
                      className="flex items-center gap-1 px-2 py-1 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
                    >
                      <Copy size={12} />
                      {copiedId === message.id ? '已复制' : '复制'}
                    </button>
                    {index === messages.length - 1 && (
                      <button
                        onClick={handleRegenerate}
                        className="flex items-center gap-1 px-2 py-1 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
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
          
          {isLoading && (
            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center flex-shrink-0">
                <Bot size={16} className="text-white" />
              </div>
              <div className="bg-gray-100 rounded-2xl px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-orange-500 rounded-full animate-bounce" />
                    <span className="w-2 h-2 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                    <span className="w-2 h-2 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                  </div>
                  <button
                    onClick={handleCancel}
                    className="ml-2 p-1 text-gray-400 hover:text-red-500 transition-colors"
                    title="取消"
                  >
                    <Square size={12} />
                  </button>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="border-t border-gray-200 p-4 bg-white">
          {errorMessage && (
            <div className="max-w-4xl mx-auto mb-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center justify-between">
              <span>{errorMessage}</span>
              <button
                onClick={() => setErrorMessage(null)}
                className="text-red-500 hover:text-red-700"
              >
                <X size={16} />
              </button>
            </div>
          )}
          <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} className="max-w-4xl mx-auto">
            <div className="relative flex items-end gap-2 bg-gray-100 rounded-xl p-2 border border-gray-200 focus-within:border-orange-300 focus-within:ring-2 focus-within:ring-orange-100 transition-all">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="输入你的创业问题..."
                rows={1}
                disabled={isLoading}
                className="flex-1 bg-transparent border-0 resize-none px-3 py-2 focus:outline-none focus:ring-0 max-h-[200px] text-gray-800 placeholder-gray-400"
              />
              {isLoading ? (
                <button
                  type="button"
                  onClick={handleCancel}
                  className="p-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                >
                  <Square size={18} />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!input.trim()}
                  className="p-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Send size={18} />
                </button>
              )}
            </div>
            <p className="text-xs text-gray-400 text-center mt-2">
              按 Enter 发送，Shift + Enter 换行
            </p>
          </form>
        </div>
      </main>
    </div>
  );
}
