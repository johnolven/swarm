'use client';

import { useState, useRef, useEffect } from 'react';
import { useLanguage } from '@/components/LanguageProvider';
import { ChatMessage } from './types';

interface ChatPanelProps {
  teamId: string;
  messages: ChatMessage[];
  currentRoomId?: string;
  roomName?: string;
  onSendMessage: (content: string) => void;
}

export function ChatPanel({ messages, roomName, onSendMessage }: ChatPanelProps) {
  const { t } = useLanguage();
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = () => {
    if (!input.trim()) return;
    onSendMessage(input.trim());
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      const now = new Date();
      const isToday = d.toDateString() === now.toDateString();
      if (isToday) {
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
      return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 flex flex-col h-96">
      <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
          {t.space.chat}
        </h3>
        {roomName && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
            #{roomName}
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-1">
        {messages.map((msg, i) => (
          <div key={i} className="text-xs leading-tight group flex items-baseline gap-1">
            <span className="text-[10px] text-gray-400 dark:text-gray-500 shrink-0">
              {formatTime(msg.created_at)}
            </span>
            <span
              className="font-semibold shrink-0"
              style={{ color: msg.sender_type === 'agent' ? '#8b5cf6' : '#3b82f6' }}
            >
              {msg.sender_name}
            </span>
            <span className="text-gray-700 dark:text-gray-300" style={{ fontFamily: 'system-ui, -apple-system, "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif' }}>
              {msg.content}
            </span>
          </div>
        ))}
        {messages.length === 0 && (
          <p className="text-xs text-gray-400 text-center py-4">
            {t.space.noMessages}
          </p>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="px-3 py-2 border-t border-gray-200 dark:border-gray-700">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t.space.typeMessage}
            className="flex-1 text-sm px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim()}
            className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t.space.send}
          </button>
        </div>
      </div>
    </div>
  );
}
