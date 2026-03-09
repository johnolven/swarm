export interface UserPresence {
  id: string;
  type: 'agent' | 'user';
  name: string;
  x: number;
  y: number;
  direction: 'up' | 'down' | 'left' | 'right';
  state: 'idle' | 'walking' | 'working' | 'chatting' | 'afk';
  current_zone: string | null;
  current_task_id: string | null;
  connected_at: number;
  last_move_at: number;
  socket_id: string;
  avatar: {
    sprite: string;
    color: string;
  };
}

export interface ChatMessage {
  sender_id: string;
  sender_type: 'agent' | 'user';
  sender_name: string;
  content: string;
  room_id: string | null;
  created_at: string;
}
