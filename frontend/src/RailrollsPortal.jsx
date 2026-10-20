import React, { useState, useEffect } from 'react';

const API_BASE = 'http://localhost:5000';

export default function RailrollsPortal({ currentUser, onBackToDashboard }) {
  // Flow States
  // 1. 'phone_entry' -> enter phone
  // 2. 'portal_active' -> authenticated inside Railrolls
  const [step, setStep] = useState(currentUser ? 'portal_active' : 'phone_entry');
  const [phoneInput, setPhoneInput] = useState(currentUser?.phone || '');
  const [activePlayer, setActivePlayer] = useState(currentUser || null);

  // Modal State for New Player Onboarding
  const [showNewPlayerModal, setShowNewPlayerModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newAge, setNewAge] = useState('');

  // Live Backend State
  const [gameplays, setGameplays] = useState(0);
  const [unclaimedInvoices, setUnclaimedInvoices] = useState([]);
  const [statusMessage, setStatusMessage] = useState('');
  const [playHistory, setPlayHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeSessionToken, setActiveSessionToken] = useState(null);

  // Sync player status with backend on load or when player's phone changes
  useEffect(() => {
    if (activePlayer?.phone) {
      fetchPlayerStatus(activePlayer.phone);
    }
  }, [activePlayer?.phone]);

  // 1. Query Player Status & Unclaimed Bills from Backend
  const fetchPlayerStatus = async (phone) => {
    try {
      setIsLoading(true);
      const res = await fetch(`${API_BASE}/api/v1/gameplays/status?phone=${phone}&brand=railrolls`);
      const data = await res.json();

      if (data.success) {
        setGameplays(data.playsRemaining || 0);
        setUnclaimedInvoices(data.unclaimedInvoices || []);
        // Only update activePlayer if not yet set or if user ID differs, preventing reference loop
        if (data.user && (!activePlayer || activePlayer.id !== data.user.id)) {
          setActivePlayer(data.user);
        }
      }
    } catch (err) {
      console.error('Failed to sync player status:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // 2. Phone Verification via Live Backend Check
  const handleVerifyPhone = async (e) => {
    e.preventDefault();
    if (!phoneInput) return;

    try {
      setIsLoading(true);
      const res = await fetch(`${API_BASE}/api/v1/gameplays/status?phone=${phoneInput}&brand=railrolls`);
      const data = await res.json();

      if (data.success && data.userExists) {
        setActivePlayer(data.user);
        setGameplays(data.playsRemaining || 0);
        setUnclaimedInvoices(data.unclaimedInvoices || []);
        setStep('portal_active');
        setStatusMessage(`WELCOME BACK, ${data.user.name.toUpperCase()}! CONNECTED TO POSTGRESQL.`);
      } else {
        // Player not registered -> Open registration modal
        setShowNewPlayerModal(true);
      }
    } catch (err) {
      setStatusMessage('⚠️ FAILED TO REACH BACKEND SERVER. IS PORT 5000 RUNNING?');
    } finally {
      setIsLoading(false);
    }
  };

  // 3. New User Registration via Backend /api/register
  const handleCreateNewPlayer = async (e) => {
    e.preventDefault();
    try {
      setIsLoading(true);
      const res = await fetch(`${API_BASE}/api/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phoneInput, name: newName, age: parseInt(newAge) })
      });
      const data = await res.json();

      if (data.success) {
        setActivePlayer(data.user);
        setShowNewPlayerModal(false);
        setStep('portal_active');
        setStatusMessage(`PROFILE CREATED IN POSTGRESQL! WELCOME, ${data.user.name.toUpperCase()}.`);
        fetchPlayerStatus(data.user.phone);
      } else {
        alert(data.error || 'Registration failed');
      }
    } catch (err) {
      alert('Network failure during registration');
    } finally {
      setIsLoading(false);
    }
  };

  // 4. Verify Bill & Claim 3 Gameplays (Calls Atomic Backend Claim)
  const handleVerifyBill = async () => {
    if (!activePlayer?.phone) return;

    try {
      setIsLoading(true);
      const targetInvoice = unclaimedInvoices.length > 0 ? unclaimedInvoices[0].invoiceNumber : undefined;
      const res = await fetch(`${API_BASE}/api/v1/gameplays/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: activePlayer.phone, invoiceNumber: targetInvoice })
      });
      const data = await res.json();

      if (data.success) {
        setGameplays(data.playsRemaining);
        setStatusMessage(`✅ ${data.message.toUpperCase()} [CLAIMED IN POSTGRESQL]`);
        fetchPlayerStatus(activePlayer.phone);
      } else {
        setStatusMessage(`⚠️ ${data.error.toUpperCase()}`);
      }
    } catch (err) {
      setStatusMessage('⚠️ NETWORK ERROR WHILE CLAIMING BILL.');
    } finally {
      setIsLoading(false);
    }
  };

  // 5. Play Game (Burns 1 Credit & Issues Anti-Cheat Session Token)
  const handlePlayGame = async () => {
    if (gameplays <= 0 || !activePlayer?.phone) {
      setStatusMessage('❌ 0 GAMEPLAYS REMAINING. VERIFY A NEW BILL TO PLAY MORE.');
      return;
    }

    try {
      setIsLoading(true);
      // Start Game Session (burns 1 credit in DB)
      const startRes = await fetch(`${API_BASE}/api/v1/games/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: activePlayer.phone, brandSlug: 'railrolls' })
      });
      const startData = await startRes.json();

      if (!startData.success) {
        setStatusMessage(`⚠️ ${startData.error.toUpperCase()}`);
        return;
      }

      setGameplays(startData.playsRemaining);
      setActiveSessionToken(startData.sessionToken);

      // Simulate game round & finish session
      const simulatedScore = Math.floor(Math.random() * 2500) + 1500;

      const finishRes = await fetch(`${API_BASE}/api/v1/games/finish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionToken: startData.sessionToken, score: simulatedScore })
      });
      const finishData = await finishRes.json();

      const newHistoryItem = {
        round: playHistory.length + 1,
        score: simulatedScore,
        token: startData.sessionToken.slice(0, 16) + '...',
        time: new Date().toLocaleTimeString()
      };
      setPlayHistory([newHistoryItem, ...playHistory]);

      if (startData.playsRemaining > 0) {
        setStatusMessage(`🎮 SESSION COMMITTED! SCORE: ${simulatedScore} PTS. (${startData.playsRemaining} PLAY${startData.playsRemaining > 1 ? 'S' : ''} REMAINING IN POSTGRESQL)`);
      } else {
        setStatusMessage(`🏁 FINAL PLAY EXHAUSTED! SCORE: ${simulatedScore} PTS. (0 PLAYS REMAINING)`);
      }
    } catch (err) {
      setStatusMessage('⚠️ ERROR COMMUNICATING WITH BACKEND SESSION CONTROLLER.');
    } finally {
      setIsLoading(false);
    }
  };

  // 6. Reset Demo State in PostgreSQL
  const handleResetDemo = async () => {
    try {
      setIsLoading(true);
      const res = await fetch(`${API_BASE}/api/dev/reset-demo`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setGameplays(0);
        setPlayHistory([]);
        setStatusMessage('POSTGRESQL RESET: BILL #ORD_98214 MARKED UNCLAIMED. READY TO TEST!');
        if (activePlayer?.phone) {
          fetchPlayerStatus(activePlayer.phone);
        }
      }
    } catch (err) {
      setStatusMessage('⚠️ FAILED TO RESET BACKEND DEMO.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-card" style={{ width: '580px', maxWidth: '94vw' }}>
      {/* Brand Header */}
      <div style={{ textAlign: 'center', marginBottom: '1.5rem', borderBottom: '1px solid rgba(182, 255, 59, 0.2)', paddingBottom: '1rem' }}>
        <div style={{ display: 'inline-block', background: 'rgba(182, 255, 59, 0.15)', border: '1px solid var(--color-solar-lime)', color: 'var(--color-solar-lime)', padding: '3px 12px', fontSize: '0.72rem', fontFamily: 'var(--font-primary)', letterSpacing: '1px', marginBottom: '0.5rem' }}>
          POSTGRESQL LIVE ARCHITECTURE // RAILROLLS
        </div>
        <h2 style={{ color: 'var(--color-solar-lime)', fontSize: '1.6rem', fontFamily: 'var(--font-primary)', textShadow: '0 0 10px rgba(182, 255, 59, 0.4)' }}>
          RAILROLLS REWARDS // MOBILE PORTAL
        </h2>
        <p style={{ fontSize: '0.75rem', color: '#888' }}>
          OUTLET: KORAMANGALA #RR_BLR_01 // BYOD QR PROOF-OF-PURCHASE
        </p>
      </div>

      {/* STEP 1: PHONE VERIFICATION (If not already authenticated) */}
      {step === 'phone_entry' && (
        <div>
          <p style={{ fontSize: '0.85rem', color: 'var(--color-gray)', marginBottom: '1rem', textAlign: 'center' }}>
            ENTER CUSTOMER PHONE NUMBER TO SCAN FOR BILLS:
          </p>
          <form onSubmit={handleVerifyPhone}>
            <input
              type="tel"
              className="input-field"
              placeholder="ENTER PHONE (e.g. 9876543210)"
              required
              value={phoneInput}
              onChange={(e) => setPhoneInput(e.target.value)}
            />
            <button type="submit" className="btn-primary" disabled={isLoading}>
              {isLoading ? 'CHECKING DATABASE...' : 'VERIFY PHONE NUMBER'}
            </button>
          </form>
          <button onClick={onBackToDashboard} className="btn-secondary" style={{ marginTop: '1rem' }}>
            RETURN TO MAIN HUB
          </button>
        </div>
      )}

      {/* STEP 2: ACTIVE RAILROLLS KIOSK INTERFACE */}
      {step === 'portal_active' && (
        <div>
          {/* Active Player Card */}
          <div style={{ background: 'rgba(12, 26, 43, 0.6)', border: '1px solid var(--color-solar-lime)', borderRadius: '4px', padding: '1rem', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '0.7rem', color: '#888' }}>AUTHENTICATED OPERATOR</div>
                <div style={{ fontSize: '1.1rem', color: 'var(--color-solar-lime)', fontFamily: 'var(--font-primary)' }}>
                  {activePlayer?.name?.toUpperCase() || 'OPERATOR'}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.7rem', color: '#888' }}>PHONE LINK</div>
                <div style={{ fontSize: '0.9rem', fontFamily: 'var(--font-primary)', letterSpacing: '1px' }}>
                  {activePlayer?.phone}
                </div>
              </div>
            </div>
          </div>

          {/* Gameplay Credit Meter (3 Token Indicators) */}
          <div style={{ textAlign: 'center', marginBottom: '1.5rem', background: 'rgba(6, 13, 22, 0.7)', padding: '1.2rem', borderRadius: '4px', border: '1px solid rgba(182, 255, 59, 0.3)' }}>
            <div style={{ fontSize: '0.75rem', color: '#888', marginBottom: '0.5rem', letterSpacing: '1px' }}>
              POSTGRESQL WALLET BALANCE
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem', margin: '0.75rem 0' }}>
              {[1, 2, 3].map((tokenNum) => (
                <div
                  key={tokenNum}
                  style={{
                    width: '45px',
                    height: '45px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: 'var(--font-primary)',
                    fontSize: '1.1rem',
                    fontWeight: 'bold',
                    border: tokenNum <= gameplays ? '2px solid var(--color-solar-lime)' : '2px solid #444',
                    background: tokenNum <= gameplays ? 'rgba(182, 255, 59, 0.2)' : 'rgba(255,255,255,0.03)',
                    color: tokenNum <= gameplays ? 'var(--color-solar-lime)' : '#555',
                    boxShadow: tokenNum <= gameplays ? '0 0 15px rgba(182, 255, 59, 0.4)' : 'none',
                    transition: 'all 0.3s ease'
                  }}
                >
                  ⚡
                </div>
              ))}
            </div>

            <div style={{ fontSize: '1.3rem', fontFamily: 'var(--font-primary)', color: gameplays > 0 ? 'var(--color-solar-lime)' : '#888' }}>
              {gameplays} / 3 PLAYS
            </div>
          </div>

          {/* Status Alert Banner */}
          {statusMessage && (
            <div style={{
              background: statusMessage.includes('✅') || statusMessage.includes('WELCOME') || statusMessage.includes('COMMITTED') ? 'rgba(182, 255, 59, 0.1)' : 'rgba(255, 77, 77, 0.1)',
              borderLeft: statusMessage.includes('✅') || statusMessage.includes('WELCOME') || statusMessage.includes('COMMITTED') ? '3px solid var(--color-solar-lime)' : '3px solid red',
              padding: '0.75rem 1rem',
              fontSize: '0.8rem',
              marginBottom: '1.2rem',
              fontFamily: 'var(--font-primary)',
              lineHeight: '1.4'
            }}>
              {statusMessage}
            </div>
          )}

          {/* Pending Unclaimed Bill Alert */}
          {unclaimedInvoices.length > 0 && (
            <div style={{
              background: 'rgba(182, 255, 59, 0.08)',
              border: '1px dashed var(--color-solar-lime)',
              padding: '0.75rem 1rem',
              borderRadius: '4px',
              marginBottom: '1rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <div style={{ fontSize: '0.68rem', color: '#888' }}>POS BILL DETECTED</div>
                <div style={{ fontSize: '1rem', color: 'var(--color-solar-lime)', fontFamily: 'var(--font-primary)' }}>
                  #{unclaimedInvoices[0].invoiceNumber} (₹{unclaimedInvoices[0].amount})
                </div>
              </div>
              <div style={{ fontSize: '0.72rem', color: '#aaa', textAlign: 'right' }}>
                OUTLET: {unclaimedInvoices[0].outletCode}<br/>
                {unclaimedInvoices[0].itemsCount} ITEMS
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {/* Verify Bill Button */}
            <button
              onClick={handleVerifyBill}
              className="btn-primary"
              disabled={isLoading || unclaimedInvoices.length === 0}
              style={{
                background: unclaimedInvoices.length > 0 ? 'var(--color-solar-lime)' : '#1e2d3d',
                color: unclaimedInvoices.length > 0 ? '#060d16' : '#888',
                cursor: isLoading || unclaimedInvoices.length === 0 ? 'not-allowed' : 'pointer',
                opacity: isLoading ? 0.75 : 1
              }}
            >
              {isLoading 
                ? '⚡ SYNCING DATABASE...' 
                : unclaimedInvoices.length > 0 
                  ? `CLAIM BILL #${unclaimedInvoices[0].invoiceNumber} (3 PLAYS)` 
                  : 'NO UNCLAIMED BILLS FOUND'}
            </button>

            {/* Play Game Button (Burns 1 credit in PostgreSQL) */}
            <button
              onClick={handlePlayGame}
              className="btn-primary"
              disabled={gameplays <= 0 || isLoading}
              style={{
                background: gameplays > 0 ? '#ffaa00' : '#333',
                borderColor: gameplays > 0 ? '#ffaa00' : '#444',
                color: gameplays > 0 ? '#000' : '#666',
                cursor: gameplays > 0 && !isLoading ? 'pointer' : 'not-allowed',
                boxShadow: gameplays > 0 ? '0 0 15px rgba(255, 170, 0, 0.4)' : 'none'
              }}
            >
              {gameplays > 0 ? `PLAY GAME (${gameplays} REMAINING)` : 'NO GAMEPLAYS LEFT'}
            </button>
          </div>

          {/* Gameplay History Log */}
          {playHistory.length > 0 && (
            <div style={{ marginTop: '1.5rem', background: 'rgba(6, 13, 22, 0.6)', padding: '0.75rem', borderRadius: '4px', border: '1px solid #333' }}>
              <div style={{ fontSize: '0.7rem', color: '#888', marginBottom: '0.5rem', fontFamily: 'var(--font-primary)' }}>
                SESSION AUDIT LOG (POSTGRESQL):
              </div>
              {playHistory.map((h, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', padding: '3px 0', borderBottom: '1px solid #222' }}>
                  <span>ROUND #{h.round} ({h.token})</span>
                  <span style={{ color: 'var(--color-solar-lime)', fontFamily: 'var(--font-primary)' }}>{h.score} PTS</span>
                  <span style={{ color: '#777' }}>{h.time}</span>
                </div>
              ))}
            </div>
          )}

          {/* Controls to Switch User / Back to Hub */}
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.5rem' }}>
            <button onClick={handleResetDemo} className="btn-secondary" style={{ fontSize: '0.75rem' }} disabled={isLoading}>
              RESET DEMO
            </button>
            <button onClick={() => setStep('phone_entry')} className="btn-secondary" style={{ fontSize: '0.75rem' }}>
              CHANGE PHONE
            </button>
            <button onClick={onBackToDashboard} className="btn-secondary" style={{ fontSize: '0.75rem', color: '#ff4d4d', borderColor: 'rgba(255,77,77,0.4)' }}>
              EXIT PORTAL
            </button>
          </div>
        </div>
      )}

      {/* NEW PLAYER ONBOARDING MODAL */}
      {showNewPlayerModal && (
        <div className="modal-backdrop">
          <div className="modal-box">
            <h3 style={{ fontFamily: 'var(--font-primary)', color: 'var(--color-solar-lime)', fontSize: '1.2rem', marginBottom: '0.5rem' }}>
              NEW RAILROLLS GUEST DETECTED
            </h3>

            <div className="modal-badge">
              PHONE LINK: {phoneInput}
            </div>

            <p style={{ fontSize: '0.85rem', color: 'var(--color-gray)', marginBottom: '1.5rem', lineHeight: '1.4' }}>
              No profile found for this number. Complete your details once to unlock gameplays:
            </p>

            <form onSubmit={handleCreateNewPlayer}>
              <input
                type="text"
                className="input-field"
                placeholder="PLAYER FULL NAME"
                required
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />

              <input
                type="number"
                className="input-field"
                placeholder="AGE"
                min="1"
                max="120"
                required
                value={newAge}
                onChange={(e) => setNewAge(e.target.value)}
              />

              <button type="submit" className="btn-primary" disabled={isLoading}>
                {isLoading ? 'CREATING RECORD...' : 'CREATE PROFILE & ENTER KIOSK'}
              </button>

              <button type="button" onClick={() => setShowNewPlayerModal(false)} className="btn-secondary">
                CANCEL
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
