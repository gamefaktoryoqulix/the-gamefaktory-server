import React, { useState } from 'react';

export default function CreateAccount({ toggleForm, onLogin }) {
  const [formData, setFormData] = useState({ phone: '', name: '', age: '' });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    
    try {
      const response = await fetch('http://localhost:5000/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      
      const data = await response.json();
      
      if (data.success && data.user) {
        setMessage('ACCOUNT INITIALIZED SUCCESSFULLY');
        if (onLogin) {
          setTimeout(() => onLogin(data.user), 1000);
        } else {
          setTimeout(() => toggleForm(), 1500);
        }
      } else {
        setMessage(data.error || 'REGISTRATION FAILED');
      }
    } catch (err) {
      setMessage('CONNECTION LOST. SYSTEM ERROR.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-card">
      <div className="glitch-wrapper">
        <div className="glitch">
          GameFaktory
          <span>GameFaktory</span>
          <span>GameFaktory</span>
        </div>
      </div>
      <div className="auth-header">
        <p>ESTABLISH NEW CONNECTION</p>
      </div>
      <form onSubmit={handleSubmit}>
        <input type="tel" className="input-field" placeholder="PHONE NUMBER" required 
          value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
        <input type="text" className="input-field" placeholder="FULL NAME" required 
          value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
        <input type="number" className="input-field" placeholder="AGE" min="1" required 
          value={formData.age} onChange={e => setFormData({...formData, age: e.target.value})} />
        
        {message && <p style={{ color: message.includes('SUCCESS') ? 'var(--color-solar-lime)' : 'red', textAlign: 'center', marginBottom: '1rem', fontSize: '0.8rem', fontFamily: 'var(--font-primary)' }}>{message}</p>}
        
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? 'INITIALIZING...' : 'INITIALIZE ACCOUNT'}
        </button>
      </form>
      <div className="toggle-link" onClick={toggleForm}>
        [ RETURN TO LOGIN TERMINAL ]
      </div>
    </div>
  );
}
