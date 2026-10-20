import React from 'react';

export default function Dashboard({ user, onLogout, onOpenRailrolls }) {
  return (
    <div className="auth-card" style={{ width: '520px', maxWidth: '90vw' }}>
      <div className="auth-header" style={{ marginBottom: '1.5rem' }}>
        <p style={{ color: 'var(--color-solar-lime)', fontSize: '1.5rem', textShadow: '0 0 10px var(--color-solar-lime)' }}>
          WELCOME, {(user.name || 'OPERATOR').toUpperCase()}
        </p>
        <p style={{ fontSize: '0.8rem', opacity: 0.7 }}>STATUS: ONLINE // CLEARANCE: STANDARD</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
        <div style={{ background: 'rgba(12,26,43,0.5)', padding: '1rem', border: '1px solid var(--color-solar-lime)', borderRadius: '4px' }}>
          <div style={{ fontSize: '0.7rem', color: '#888', marginBottom: '0.5rem' }}>IDENTIFICATION</div>
          <div style={{ fontSize: '1.2rem', fontFamily: 'var(--font-primary)' }}>{user.id ? user.id.split('-')[0] : 'OPERATOR'}***</div>
        </div>
        <div style={{ background: 'rgba(12,26,43,0.5)', padding: '1rem', border: '1px solid var(--color-solar-lime)', borderRadius: '4px' }}>
          <div style={{ fontSize: '0.7rem', color: '#888', marginBottom: '0.5rem' }}>AGE CYCLE</div>
          <div style={{ fontSize: '1.2rem', fontFamily: 'var(--font-primary)' }}>{user.age}</div>
        </div>
        <div style={{ background: 'rgba(12,26,43,0.5)', padding: '1rem', border: '1px solid var(--color-solar-lime)', borderRadius: '4px', gridColumn: 'span 2' }}>
          <div style={{ fontSize: '0.7rem', color: '#888', marginBottom: '0.5rem' }}>COMMUNICATION LINK</div>
          <div style={{ fontSize: '1.2rem', fontFamily: 'var(--font-primary)', letterSpacing: '2px' }}>{user.phone}</div>
        </div>
      </div>

      {/* Button to Launch Railrolls Portal */}
      <button 
        onClick={onOpenRailrolls} 
        className="btn-primary" 
        style={{ 
          background: 'linear-gradient(135deg, #ffaa00 0%, #ff5500 100%)', 
          borderColor: '#ffaa00', 
          color: '#000', 
          marginBottom: '1rem',
          boxShadow: '0 0 15px rgba(255, 170, 0, 0.4)'
        }}
      >
        🚀 ENTER RAILROLLS PORTAL
      </button>

      <button onClick={onLogout} className="btn-primary" style={{ background: 'transparent', color: 'red', borderColor: 'red', boxShadow: 'none' }}>
        DISCONNECT TERMINAL
      </button>
    </div>
  );
}
