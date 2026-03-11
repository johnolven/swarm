'use client';

import { use, useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getToken } from '@/lib/auth';
import { PhaserGame, PhaserGameHandle } from '@/components/space/PhaserGame';
import { ChatPanel } from '@/components/space/ChatPanel';
import { PresenceList } from '@/components/space/PresenceList';
import { CharacterPicker } from '@/components/space/CharacterPicker';
import { UserPresence, ChatMessage } from '@/components/space/types';
import { ThemeToggle } from '@/components/ThemeToggle';
import { LangToggle } from '@/components/LangToggle';
import { useLanguage } from '@/components/LanguageProvider';

function parseJwt(token: string) {
  try {
    return JSON.parse(atob(token.split('.')[1]));
  } catch {
    return null;
  }
}

interface ZoneInfo {
  id: string;
  label: string;
}

interface RoomInfo {
  id: string;
  name: string;
  type?: string;
  zone_id?: string;
}

interface BoardColumn {
  id: string;
  name: string;
  color: string;
  order: number;
}

interface BoardTask {
  id: string;
  title: string;
  description?: string | null;
  priority: 'low' | 'medium' | 'high';
  status?: string | null;
  column_id: string | null;
  order: number;
  required_capabilities?: string[];
  assigned_to?: { id: string; name: string; capabilities?: string[] } | null;
}

export default function SpacePage({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = use(params);
  const router = useRouter();
  const { t } = useLanguage();
  const [presences, setPresences] = useState<UserPresence[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [teamName, setTeamName] = useState('Space');
  const [currentZone, setCurrentZone] = useState<ZoneInfo | null>(null);
  const [currentRoom, setCurrentRoom] = useState<RoomInfo | null>(null);
  const [rooms, setRooms] = useState<RoomInfo[]>([]);
  const [ready, setReady] = useState(false);
  const [spaceConfig, setSpaceConfig] = useState<any>(null);
  const [showCharPicker, setShowCharPicker] = useState(false);
  const [showBoard, setShowBoard] = useState(false);
  const [boardColumns, setBoardColumns] = useState<BoardColumn[]>([]);
  const [boardTasks, setBoardTasks] = useState<BoardTask[]>([]);
  const [boardLoading, setBoardLoading] = useState(false);
  const [characterId, setCharacterId] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('swarm_character_id');
      return saved ? parseInt(saved, 10) : 1;
    }
    return 1;
  });
  const [userInfo, setUserInfo] = useState<{
    id: string;
    name: string;
    type: 'agent' | 'user';
  } | null>(null);
  const phaserRef = useRef<PhaserGameHandle>(null);

  // Socket-like interface for Phaser (local events only)
  const listenersRef = useRef<Map<string, Set<(...args: any[]) => void>>>(new Map());
  const socketLike = useRef({
    emit: (event: string, data: any) => {
      // Handle outgoing events
      const handlers = listenersRef.current.get(`__emit__${event}`);
      handlers?.forEach(h => h(data));
    },
    on: (event: string, handler: (...args: any[]) => void) => {
      if (!listenersRef.current.has(event)) {
        listenersRef.current.set(event, new Set());
      }
      listenersRef.current.get(event)!.add(handler);
    },
    off: (event: string) => {
      listenersRef.current.delete(event);
    },
  });

  // Dispatch an event to all listeners
  const dispatch = useCallback((event: string, ...args: any[]) => {
    const handlers = listenersRef.current.get(event);
    handlers?.forEach(h => h(...args));
  }, []);

  // Parse user from JWT, then fetch profile for nickname/avatar
  useEffect(() => {
    const token = getToken();
    if (!token) { router.push('/login'); return; }
    const payload = parseJwt(token);
    if (!payload) { router.push('/login'); return; }

    if (payload.type === 'human') {
      // Fetch full profile to get nickname + avatar_id
      fetch('/api/users/profile', { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (data?.data) {
            const p = data.data;
            const displayName = p.nickname || p.name || payload.name;
            setUserInfo({ id: payload.user_id, name: displayName, type: 'user' });
            if (p.avatar_id) {
              setCharacterId(p.avatar_id);
              localStorage.setItem('swarm_character_id', String(p.avatar_id));
            }
          } else {
            setUserInfo({ id: payload.user_id, name: payload.name, type: 'user' });
          }
        })
        .catch(() => {
          setUserInfo({ id: payload.user_id, name: payload.name, type: 'user' });
        });
    } else if (payload.agent_id) {
      setUserInfo({ id: payload.agent_id, name: payload.name, type: 'agent' });
    }
  }, [router]);

  // Fetch team name and rooms, then create general room if needed
  useEffect(() => {
    const token = getToken();
    if (!token) return;
    const headers = { Authorization: `Bearer ${token}` };

    Promise.all([
      fetch(`/api/teams/${teamId}`, { headers }).then(r => r.ok ? r.json() : null),
      fetch(`/api/teams/${teamId}/rooms`, { headers }).then(r => r.ok ? r.json() : null),
      fetch(`/api/teams/${teamId}/space/config`, { headers }).then(r => r.ok ? r.json() : null),
    ]).then(async ([teamData, roomsData, configData]) => {
      if (teamData?.data) setTeamName(teamData.data.name);
      if (configData?.data) setSpaceConfig(configData.data);

      let roomList = roomsData?.data || [];

      // Create General room if none exists
      if (roomList.length === 0) {
        try {
          const res = await fetch(`/api/teams/${teamId}/rooms`, {
            method: 'POST',
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 'General', type: 'general' }),
          });
          if (res.ok) {
            const d = await res.json();
            roomList = [d.data];
          }
        } catch { /* ignore */ }
      }

      setRooms(roomList);
      const general = roomList.find((r: RoomInfo) => r.type === 'general' || r.name === 'General');
      if (general) {
        setCurrentRoom(general);
        loadRoomMessages(general.id);
      }
      setReady(true);
    }).catch(() => setReady(true));
  }, [teamId]);

  // Listen for space:join from Phaser and respond with presence sync
  useEffect(() => {
    if (!userInfo || !ready) return;

    // When Phaser emits space:join, call backend to get saved position
    const handleJoin = async () => {
      const token = getToken();
      let myPresence: UserPresence = {
        id: userInfo.id,
        type: userInfo.type,
        name: userInfo.name,
        x: 17,
        y: 28,
        direction: 'down',
        state: 'idle',
        current_zone: null,
        current_task_id: null,
        connected_at: Date.now(),
        last_move_at: Date.now(),
        socket_id: 'local',
        avatar: {
          sprite: userInfo.type === 'agent' ? 'agent-default' : 'human-default',
          color: userInfo.type === 'agent' ? '#8b5cf6' : '#3b82f6',
        },
      };

      // Call backend join to restore last position
      if (token) {
        try {
          const res = await fetch(`/api/teams/${teamId}/space/join`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          });
          if (res.ok) {
            const data = await res.json();
            const joinData = data.data?.self || data.data;
            if (joinData) {
              myPresence = { ...myPresence, ...joinData, socket_id: 'local' };
            }
          }
        } catch { /* use default position */ }
      }

      setPresences([myPresence]);
      dispatch('space:presence:sync', { users: [myPresence] });
    };

    // Handle move events from Phaser - persist to backend (throttled)
    let moveTimer: ReturnType<typeof setTimeout> | null = null;
    let lastMove: any = null;
    const flushMove = () => {
      if (!lastMove) return;
      const token = getToken();
      if (token) {
        fetch(`/api/teams/${teamId}/space/move`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(lastMove),
        }).catch(() => {});
      }
      lastMove = null;
    };

    const handleMove = (data: any) => {
      setPresences(prev => prev.map(p =>
        p.id === userInfo.id ? { ...p, x: data.x, y: data.y, direction: data.direction } : p
      ));
      // Throttle: save position every 500ms
      lastMove = { x: data.x, y: data.y, direction: data.direction };
      if (!moveTimer) {
        moveTimer = setTimeout(() => { flushMove(); moveTimer = null; }, 500);
      }
    };

    // Handle zone enter/exit
    const handleZoneEnter = (data: any) => {
      setPresences(prev => prev.map(p =>
        p.id === userInfo.id ? { ...p, current_zone: data.zoneId } : p
      ));
    };

    const handleZoneExit = () => {
      setPresences(prev => prev.map(p =>
        p.id === userInfo.id ? { ...p, current_zone: null } : p
      ));
    };

    // Handle chat from Phaser
    const handleChat = async (data: any) => {
      const token = getToken();
      const msg: ChatMessage = {
        sender_id: userInfo.id,
        sender_type: userInfo.type,
        sender_name: userInfo.name,
        content: data.content,
        room_id: data.roomId || currentRoom?.id || null,
        created_at: new Date().toISOString(),
      };

      setMessages(prev => [...prev, msg]);

      // Persist to DB
      if (data.roomId || currentRoom?.id) {
        try {
          await fetch(`/api/rooms/${data.roomId || currentRoom?.id}/messages`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ content: data.content }),
          });
        } catch { /* ignore */ }
      }

      // Echo back to Phaser
      dispatch('space:chat:message', { message: msg });
    };

    // Handle emote
    const handleEmote = (data: any) => {
      dispatch('space:emote', { userId: userInfo.id, emote: data.emote });
    };

    const emitKeys = [
      '__emit__space:join',
      '__emit__space:move',
      '__emit__space:zone:enter',
      '__emit__space:zone:exit',
      '__emit__space:chat',
      '__emit__space:emote',
      '__emit__space:leave',
      '__emit__space:state',
    ];
    listenersRef.current.set('__emit__space:join', new Set([handleJoin]));
    listenersRef.current.set('__emit__space:move', new Set([handleMove]));
    listenersRef.current.set('__emit__space:zone:enter', new Set([handleZoneEnter]));
    listenersRef.current.set('__emit__space:zone:exit', new Set([handleZoneExit]));
    listenersRef.current.set('__emit__space:chat', new Set([handleChat]));
    listenersRef.current.set('__emit__space:emote', new Set([handleEmote]));
    listenersRef.current.set('__emit__space:leave', new Set([() => {}]));
    listenersRef.current.set('__emit__space:state', new Set([() => {}]));

    return () => {
      // Flush pending move before unmount
      if (moveTimer) { clearTimeout(moveTimer); flushMove(); }
      // Only remove our __emit__ handlers, preserve Phaser's socket.on() listeners
      for (const key of emitKeys) {
        listenersRef.current.delete(key);
      }
    };
  }, [userInfo, ready, currentRoom, dispatch]);

  // Send chat message from ChatPanel
  const handleSendChat = useCallback(async (content: string) => {
    if (!userInfo || !content.trim()) return;
    const token = getToken();
    const roomId = currentRoom?.id;

    const msg: ChatMessage = {
      sender_id: userInfo.id,
      sender_type: userInfo.type,
      sender_name: userInfo.name,
      content: content.trim(),
      room_id: roomId || null,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, msg]);

    if (roomId) {
      try {
        await fetch(`/api/rooms/${roomId}/messages`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ content: content.trim() }),
        });
      } catch { /* ignore */ }
    }
  }, [userInfo, currentRoom]);

  // Zone change handler
  const handleZoneChange = useCallback(async (zone: ZoneInfo | null) => {
    setCurrentZone(zone);
    const token = getToken();
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

    if (!zone) {
      const general = rooms.find(r => r.type === 'general' || r.name === 'General');
      if (general) {
        setCurrentRoom(general);
        loadRoomMessages(general.id);
      }
      return;
    }

    let room = rooms.find(r => r.zone_id === zone.id);
    if (room) {
      setCurrentRoom(room);
      loadRoomMessages(room.id);
      return;
    }

    try {
      const res = await fetch(`/api/teams/${teamId}/rooms`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ name: zone.label, type: 'zone', zone_id: zone.id }),
      });
      if (res.ok) {
        const data = await res.json();
        room = data.data;
        setRooms(prev => [...prev, room!]);
        setCurrentRoom(room!);
      }
    } catch { /* ignore */ }
  }, [rooms, teamId]);

  const loadRoomMessages = async (roomId: string) => {
    try {
      const token = getToken();
      const res = await fetch(`/api/rooms/${roomId}/messages?limit=30`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        const msgs = (data.data || []).reverse().map((m: any) => ({
          sender_id: m.sender_id,
          sender_type: m.sender_type,
          sender_name: m.sender_name,
          content: m.content,
          room_id: m.room_id,
          created_at: m.created_at,
        }));
        setMessages(msgs);
      }
    } catch { /* ignore */ }
  };

  const handleChatMessage = useCallback((msg: ChatMessage) => {
    setMessages(prev => [...prev, msg]);
  }, []);

  // Poll for new messages every 3 seconds (picks up agent messages sent via API)
  useEffect(() => {
    if (!currentRoom?.id) return;
    const roomId = currentRoom.id;

    const poll = async () => {
      try {
        const token = getToken();
        const res = await fetch(`/api/rooms/${roomId}/messages?limit=50`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          const fetched: ChatMessage[] = (data.data || []).reverse().map((m: any) => ({
            sender_id: m.sender_id,
            sender_type: m.sender_type,
            sender_name: m.sender_name,
            content: m.content,
            room_id: m.room_id,
            created_at: m.created_at,
          }));
          // Replace messages with server truth to avoid duplicates
          setMessages(fetched);
        }
      } catch { /* ignore */ }
    };

    const interval = setInterval(poll, 3000);
    return () => clearInterval(interval);
  }, [currentRoom?.id]);

  // Poll backend for real presence data (agents connected via REST API)
  useEffect(() => {
    if (!ready || !userInfo) return;
    const token = getToken();
    if (!token) return;

    const pollPresence = async () => {
      try {
        const res = await fetch(`/api/teams/${teamId}/space/presence`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          const users: UserPresence[] = data.data || [];
          if (users.length > 0) {
            // Only sync remote users to Phaser - never overwrite local player position
            const remoteOnly = users.filter(u => u.id !== userInfo!.id);
            phaserRef.current?.syncPresences(remoteOnly);
            setPresences(prev => {
              const localPlayer = prev.find(p => p.id === userInfo!.id);
              return localPlayer ? [localPlayer, ...remoteOnly] : users;
            });
          }
        }
      } catch (e) { console.error('[space] presence poll error:', e); }
    };

    const interval = setInterval(pollPresence, 2000);
    // Initial poll
    pollPresence();
    return () => clearInterval(interval);
  }, [ready, userInfo, teamId]);

  const handleCharacterSelect = useCallback(async (charId: number) => {
    setCharacterId(charId);
    localStorage.setItem('swarm_character_id', String(charId));

    // Persist to backend
    const token = getToken();
    if (token) {
      try {
        await fetch('/api/users/avatar', {
          method: 'PUT',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ avatar_id: charId }),
        });
      } catch { /* ignore */ }
    }

    // Reload page to reinitialize Phaser with new character
    window.location.reload();
  }, []);

  const openBoardPreview = useCallback(async () => {
    setShowBoard(true);
    setBoardLoading(true);
    const token = getToken();
    if (!token) { setBoardLoading(false); return; }
    const headers = { Authorization: `Bearer ${token}` };
    try {
      const [colsRes, tasksRes] = await Promise.all([
        fetch(`/api/teams/${teamId}/columns`, { headers }),
        fetch(`/api/teams/${teamId}/tasks`, { headers }),
      ]);
      if (colsRes.ok) {
        const d = await colsRes.json();
        setBoardColumns((d.data || []).sort((a: BoardColumn, b: BoardColumn) => a.order - b.order));
      }
      if (tasksRes.ok) {
        const d = await tasksRes.json();
        setBoardTasks((d.data || []).sort((a: BoardTask, b: BoardTask) => a.order - b.order));
      }
    } catch { /* ignore */ }
    setBoardLoading(false);
  }, [teamId]);

  if (!userInfo) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-3 py-2 sm:py-4 sm:px-6 lg:px-8 flex items-center justify-between">
          <Link href="/dashboard" className="text-base sm:text-2xl font-bold dark:text-white hover:text-purple-600 dark:hover:text-purple-400 transition-colors flex items-center gap-1 sm:gap-2 truncate mr-2">
            <svg className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="truncate">🐝 {teamName}</span>
          </Link>
          <div className="flex items-center gap-1 sm:gap-3">
            {currentZone && (
              <span className="text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 font-medium">
                {currentZone.label}
              </span>
            )}
            <span className="hidden sm:flex items-center gap-1 text-xs text-green-600">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
              {t.space.connected}
            </span>
            <span className="sm:hidden w-2 h-2 rounded-full bg-green-500" title={t.space.connected} />

            {/* Board */}
            <Link
              href={`/dashboard/board/${teamId}`}
              className="p-1.5 sm:p-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-all"
              title={t.space.board}
              aria-label={t.space.board}
            >
              <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
              </svg>
            </Link>

            {/* Map Editor - hidden on mobile */}
            <Link
              href={`/dashboard/space/${teamId}/editor`}
              className="hidden sm:block p-1.5 sm:p-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-all"
              title={t.space.mapEditor}
              aria-label={t.space.mapEditor}
            >
              <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
            </Link>

            {/* Change Character */}
            <button
              type="button"
              onClick={() => setShowCharPicker(true)}
              className="p-1.5 sm:p-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-all"
              title={t.space.changeCharacter}
              aria-label={t.space.changeCharacter}
            >
              <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </button>

            <span className="hidden sm:inline"><LangToggle /></span>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Main content */}
      <div className="max-w-7xl mx-auto p-4">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Game area */}
          <div className="flex-1 min-w-0">
            {/* Board preview button */}
            <button
              type="button"
              onClick={openBoardPreview}
              className="w-full mb-2 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition-colors flex items-center justify-center gap-2"
              style={{ maxWidth: 1024 }}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
              </svg>
              {t.space.boardPreview}
            </button>

            {ready ? (
              <PhaserGame
                ref={phaserRef}
                socket={socketLike.current as any}
                teamId={teamId}
                userId={userInfo.id}
                userName={userInfo.name}
                userType={userInfo.type}
                characterId={characterId}
                spaceConfig={spaceConfig}
                onPresenceUpdate={setPresences}
                onChatMessage={handleChatMessage}
                onZoneChange={handleZoneChange}
              />
            ) : (
              <div
                className="rounded-lg border border-gray-200 dark:border-gray-700 flex items-center justify-center bg-gray-100 dark:bg-gray-800"
                style={{ width: '100%', maxWidth: 1024, aspectRatio: '1024/800' }}
              >
                <div className="text-gray-400 text-sm">{t.space.loadingOffice}</div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="w-full lg:w-72 shrink-0 space-y-4">
            <PresenceList users={presences} />
            <ChatPanel
              teamId={teamId}
              messages={messages}
              currentRoomId={currentRoom?.id}
              roomName={currentRoom?.name || 'General'}
              onSendMessage={handleSendChat}
            />
          </div>
        </div>
      </div>

      {showCharPicker && (
        <CharacterPicker
          currentCharId={characterId}
          onSelect={handleCharacterSelect}
          onClose={() => setShowCharPicker(false)}
        />
      )}

      {/* Board Preview Modal */}
      {showBoard && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setShowBoard(false)}>
          <div
            className="bg-gray-50 dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-4xl mx-4 max-h-[80vh] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="bg-white dark:bg-gray-800 rounded-t-xl border-b border-gray-200 dark:border-gray-700 px-5 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-bold dark:text-white flex items-center gap-2">
                  🐝 {teamName}
                </h2>
              </div>
              <div className="flex items-center gap-3">
                <Link
                  href={`/dashboard/board/${teamId}`}
                  className="px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2"
                >
                  {t.space.goToFullBoard}
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </Link>
                <button
                  type="button"
                  onClick={() => setShowBoard(false)}
                  className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Board content — same layout as Board.tsx */}
            <div className="flex-1 overflow-auto px-4">
              {boardLoading ? (
                <div className="p-8 text-center">
                  <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-purple-600 mb-3" />
                  <p className="text-gray-600 dark:text-gray-400 text-sm">{t.space.loadingOffice}</p>
                </div>
              ) : boardColumns.length === 0 ? (
                <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                  <p>{t.space.noCols}</p>
                </div>
              ) : (
                <div className="flex gap-3 py-4 overflow-x-auto">
                  {boardColumns.map(col => {
                    const colTasks = boardTasks.filter(tk => tk.column_id === col.id);
                    return (
                      <div key={col.id} className="flex-shrink-0 flex-1 min-w-[200px]">
                        {/* Column Header */}
                        <div className={`${col.color || 'bg-gray-100'} dark:bg-gray-700 rounded-t-lg px-3 py-2`}>
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-sm dark:text-white">{col.name}</h3>
                            <span className="text-xs text-gray-600 dark:text-gray-300">
                              ({colTasks.length})
                            </span>
                          </div>
                        </div>

                        {/* Column Content */}
                        <div className="bg-gray-50 dark:bg-gray-800 rounded-b-lg p-2 min-h-[250px]">
                          <div className="space-y-2">
                            {colTasks.map(tk => (
                              <div
                                key={tk.id}
                                className="bg-white dark:bg-gray-700 rounded-lg shadow border border-gray-200 dark:border-gray-600 hover:shadow-md transition-shadow p-2.5"
                              >
                                <h3 className="text-xs font-semibold text-gray-900 dark:text-white leading-snug">{tk.title}</h3>
                                <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                                  {tk.priority && (
                                    <span className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded ${
                                      tk.priority === 'high'
                                        ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-200'
                                        : tk.priority === 'medium'
                                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200'
                                        : 'bg-gray-100 text-gray-800 dark:bg-gray-600 dark:text-gray-200'
                                    }`}>
                                      {tk.priority === 'high' && '🔴 ' + t.board.high}
                                      {tk.priority === 'medium' && '🟡 ' + t.board.medium}
                                      {tk.priority === 'low' && '🟢 ' + t.board.low}
                                    </span>
                                  )}
                                  {tk.assigned_to && (
                                    <span className="text-[10px] text-gray-500 dark:text-gray-400">
                                      🤖 {tk.assigned_to.name}
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}

                            {colTasks.length === 0 && (
                              <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-6">{t.space.noTasks}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
