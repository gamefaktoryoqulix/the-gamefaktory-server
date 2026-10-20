import React, { useState } from 'react';

export default function Login({ toggleForm, onLogin }) {
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Modal State for New Users
  const [showModal, setShowModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newAge, setNewAge] = useState('');
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState('');

  // 1. Check Phone Number
  const handleCheckPhone = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('http://localhost:5000/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone })
      });
      const data = await response.json();

      if (data.success && data.exists) {
        // User exists -> Log them in immediately and show dashboard
        onLogin(data.user);
      } else if (data.success && !data.exists) {
        // User does NOT exist -> Open modal to collect name & details
        setModalError('');
        setShowModal(true);
      } else {
        setError(data.error || 'System error validating phone number.');
      }
    } catch (err) {
      setError('CONNECTION LOST. UNABLE TO REACH SERVER.');
    } finally {
      setLoading(false);
    }
  };

  // 2. Submit New User Profile from Modal
  const handleCreateProfile = async (e) => {
    e.preventDefault();
    setModalLoading(true);
    setModalError('');

    try {
      const response = await fetch('http://localhost:5000/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone,
          name: newName,
          age: newAge
        })
      });
      const data = await response.json();

      if (data.success && data.user) {
        setShowModal(false);
        // Seamlessly log them in immediately!
        onLogin(data.user);
      } else {
        setModalError(data.error || 'Failed to create profile.');
      }
    } catch (err) {
      setModalError('SYSTEM ERROR. PROFILE CREATION FAILED.');
    } finally {
      setModalLoading(false);
    }
  };

  const handleCancelModal = () => {
    setShowModal(false);
    setNewName('');
    setNewAge('');
    setModalError('');
  };

  return (
    <>
      <div className="auth-card">
        <div className="glitch-wrapper">
          <div className="glitch">
            GameFaktory
            <span>GameFaktory</span>
            <span>GameFaktory</span>
          </div>
        </div>

        <div className="auth-header">
          <p>INITIATE OPERATOR SESSION</p>
        </div>

        <form onSubmit={handleCheckPhone}>
          <input
            type="tel"
            className="input-field"
            placeholder="ENTER PHONE NUMBER"
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />

          {error && (
            <p style={{ color: 'red', textAlign: 'center', marginBottom: '1rem', fontSize: '0.8rem', fontFamily: 'var(--font-primary)' }}>
              {error}
            </p>
          )}

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'SCANNING REGISTRY...' : 'ACCESS TERMINAL'}
          </button>
        </form>

        <div className="toggle-link" onClick={toggleForm}>
          [ MANUAL REGISTRATION CONSOLE ]
        </div>
      </div>

      {/* NEW USER ONBOARDING MODAL */}
      {showModal && (
        <div className="modal-backdrop">
          <div className="modal-box">
            <h3 style={{ fontFamily: 'var(--font-primary)', color: 'var(--color-solar-lime)', fontSize: '1.2rem', marginBottom: '0.5rem' }}>
              NEW OPERATOR DETECTED
            </h3>

            <div className="modal-badge">
              LINK: {phone}
            </div>

            <p style={{ fontSize: '0.85rem', color: 'var(--color-gray)', marginBottom: '1.5rem', lineHeight: '1.4' }}>
              No operator profile found for this communication link. Initialize your credentials to access the terminal:
            </p>

            <form onSubmit={handleCreateProfile}>
              <input
                type="text"
                className="input-field"
                placeholder="OPERATOR FULL NAME"
                required
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />

              <input
                type="number"
                className="input-field"
                placeholder="AGE CYCLE"
                min="1"
                max="120"
                required
                value={newAge}
                onChange={(e) => setNewAge(e.target.value)}
              />

              {modalError && (
                <p style={{ color: 'red', textAlign: 'center', marginBottom: '1rem', fontSize: '0.8rem', fontFamily: 'var(--font-primary)' }}>
                  {modalError}
                </p>
              )}

              <button type="submit" className="btn-primary" disabled={modalLoading}>
                {modalLoading ? 'INITIALIZING PROFILE...' : 'INITIALIZE & ENTER'}
              </button>

              <button type="button" onClick={handleCancelModal} className="btn-secondary" disabled={modalLoading}>
                CANCEL
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
