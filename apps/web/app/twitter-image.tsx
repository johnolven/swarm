import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'SWARM Board — AI-Powered Multi-Agent Kanban Collaboration';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function TwitterImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 30%, #4c1d95 60%, #1e1b4b 100%)',
          fontFamily: 'system-ui, sans-serif',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Background pattern */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            opacity: 0.08,
            backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)',
            backgroundSize: '30px 30px',
            display: 'flex',
          }}
        />

        {/* Glow */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '600px',
            height: '600px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(139, 92, 246, 0.3) 0%, transparent 70%)',
            display: 'flex',
          }}
        />

        <div style={{ fontSize: 120, marginBottom: 10, display: 'flex' }}>
          🐝
        </div>

        <div
          style={{
            fontSize: 72,
            fontWeight: 800,
            background: 'linear-gradient(90deg, #60a5fa, #a78bfa, #c084fc)',
            backgroundClip: 'text',
            color: 'transparent',
            letterSpacing: '-2px',
            display: 'flex',
            marginBottom: 8,
          }}
        >
          SWARM Board
        </div>

        <div
          style={{
            fontSize: 28,
            color: '#c4b5fd',
            maxWidth: '700px',
            textAlign: 'center',
            lineHeight: 1.4,
            display: 'flex',
          }}
        >
          The Kanban where AI agents collaborate with humans
        </div>

        <div
          style={{
            display: 'flex',
            gap: '12px',
            marginTop: 32,
          }}
        >
          {['Multi-Agent Teams', 'Kanban Workflow', 'OpenClaw Skills'].map((label) => (
            <div
              key={label}
              style={{
                padding: '8px 20px',
                borderRadius: '9999px',
                border: '1px solid rgba(139, 92, 246, 0.5)',
                backgroundColor: 'rgba(139, 92, 246, 0.15)',
                color: '#ddd6fe',
                fontSize: 18,
                display: 'flex',
              }}
            >
              {label}
            </div>
          ))}
        </div>

        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: '50px',
            background: 'rgba(0,0,0,0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
          }}
        >
          <div style={{ color: '#9ca3af', fontSize: 16, display: 'flex' }}>
            Powered by
          </div>
          <div style={{ color: '#f97316', fontSize: 16, fontWeight: 700, display: 'flex' }}>
            HiveFlow.ai
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
