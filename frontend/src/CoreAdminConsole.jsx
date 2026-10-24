import React, { useState, useEffect } from 'react';

// Default to backend on port 5000 in local dev if VITE_API_URL is not set
const API_BASE_URL = import.meta.env.VITE_API_URL || (typeof window !== 'undefined' && window.location.port === '5173' ? 'http://localhost:5000' : '');

export default function CoreAdminConsole() {

  const [activeTab, setActiveTab] = useState('register'); // 'register' | 'brands'
  const [currentStep, setCurrentStep] = useState(1); // 1: Brand Info, 2: Superadmins, 3: Normal Admins (Optional)
  
  // Step 1: Brand Info
  const [brandName, setBrandName] = useState('');
  const [gameName, setGameName] = useState('');
  const [customSlug, setCustomSlug] = useState('');
  
  // Step 2: Superadmins (At least 1 required, can add multiple)
  const [superadmins, setSuperadmins] = useState([
    { username: '', password: '', name: '' }
  ]);
  
  // Step 3: Normal Admins (Optional, can add multiple)
  const [admins, setAdmins] = useState([]);
  
  // States
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successData, setSuccessData] = useState(null);
  
  // Catalog
  const [brandsList, setBrandsList] = useState([]);
  const [isLoadingBrands, setIsLoadingBrands] = useState(false);

  // Fetch Brands Catalog
  const fetchBrands = async () => {
    setIsLoadingBrands(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/brands`);
      const data = await res.json();
      if (data.success) {
        setBrandsList(data.brands || []);
      }
    } catch (err) {
      console.error('Failed to fetch brands:', err);
    } finally {
      setIsLoadingBrands(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'brands') {
      fetchBrands();
    }
  }, [activeTab]);

  // Compute live slug preview
  const previewSlug = (customSlug || brandName)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  // Handlers for Superadmins
  const handleAddSuperadmin = () => {
    setSuperadmins([...superadmins, { username: '', password: '', name: '' }]);
  };

  const handleUpdateSuperadmin = (index, field, value) => {
    const updated = [...superadmins];
    updated[index][field] = value;
    setSuperadmins(updated);
  };

  const handleRemoveSuperadmin = (index) => {
    if (superadmins.length <= 1) return;
    setSuperadmins(superadmins.filter((_, i) => i !== index));
  };

  // Handlers for Normal Admins
  const handleAddAdmin = () => {
    setAdmins([...admins, { email: '', password: '', name: '', username: '' }]);
  };

  const handleUpdateAdmin = (index, field, value) => {
    const updated = [...admins];
    updated[index][field] = value;
    setAdmins(updated);
  };

  const handleRemoveAdmin = (index) => {
    setAdmins(admins.filter((_, i) => i !== index));
  };

  // Step Navigations
  const handleNextToSuperadmins = (e) => {
    e.preventDefault();
    setErrorMsg('');
    if (!brandName.trim()) {
      setErrorMsg('Brand name is required.');
      return;
    }
    if (!gameName.trim()) {
      setErrorMsg('Game name is required.');
      return;
    }
    setCurrentStep(2);
  };

  const handleNextToAdmins = (e) => {
    e.preventDefault();
    setErrorMsg('');
    // Validate each superadmin
    for (let i = 0; i < superadmins.length; i++) {
      const sa = superadmins[i];
      if (!sa.username.trim()) {
        setErrorMsg(`Superadmin #${i + 1} requires a username.`);
        return;
      }
      if (!sa.password || sa.password.length < 6) {
        setErrorMsg(`Superadmin #${i + 1} password must be at least 6 characters.`);
        return;
      }
    }
    setCurrentStep(3);
  };

  // Final Registration Submission
  const handleSubmitRegistration = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setIsSubmitting(true);

    // Validate any filled normal admins
    const validAdmins = [];
    for (let i = 0; i < admins.length; i++) {
      const ad = admins[i];
      if (ad.email || ad.password || ad.name) {
        if (!ad.email || !ad.email.includes('@')) {
          setErrorMsg(`Admin #${i + 1} requires a valid email.`);
          setIsSubmitting(false);
          return;
        }
        if (!ad.password || ad.password.length < 6) {
          setErrorMsg(`Admin #${i + 1} password must be at least 6 characters.`);
          setIsSubmitting(false);
          return;
        }
        validAdmins.push(ad);
      }
    }

    try {
      const payload = {
        brandName: brandName.trim(),
        gameName: gameName.trim(),
        brandSlug: previewSlug,
        superadmins: superadmins.map(s => ({
          username: s.username.trim(),
          password: s.password,
          name: s.name.trim() || s.username.trim()
        })),
        admins: validAdmins.map(a => ({
          email: a.email.trim(),
          password: a.password,
          name: a.name.trim() || a.email.split('@')[0],
          username: a.username ? a.username.trim() : a.email.split('@')[0]
        }))
      };

      const res = await fetch(`${API_BASE_URL}/api/admin/brands/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      let data;
      const text = await res.text();
      try {
        data = text ? JSON.parse(text) : {};
      } catch (parseErr) {
        throw new Error(`Server returned status ${res.status}: ${text.slice(0, 100) || res.statusText}`);
      }

      if (!res.ok || !data.success) {
        throw new Error(data.error || `Server error (${res.status})`);
      }

      setSuccessData(data);

      // Reset form
      setBrandName('');
      setGameName('');
      setCustomSlug('');
      setSuperadmins([{ username: '', password: '', name: '' }]);
      setAdmins([]);
      setCurrentStep(1);
    } catch (err) {
      console.error('Registration failed:', err);
      setErrorMsg(err.message || 'Error occurred while saving to database.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="admin-console-app">
      {/* Top Header Navbar */}
      <header className="console-header">
        <div className="brand-logo-area">
          <div className="brand-logo-glyph">GF</div>
          <div className="brand-logo-text">
            GAMEFAKTORY <span>CORE ADMIN</span>
          </div>
        </div>

        <nav className="console-nav-tabs">
          <button 
            className={`nav-tab-btn ${activeTab === 'register' ? 'active' : ''}`}
            onClick={() => { setActiveTab('register'); setSuccessData(null); }}
          >
            <span>+</span> Register Brand
          </button>
          <button 
            className={`nav-tab-btn ${activeTab === 'brands' ? 'active' : ''}`}
            onClick={() => { setActiveTab('brands'); setSuccessData(null); }}
          >
            <span>☰</span> Brands Catalog
          </button>
        </nav>

        <div className="header-status-badge">
          <div className="status-dot-pulse"></div>
          MULTI-TENANT DB CONNECTED
        </div>
      </header>

      {/* Main Workspace Area */}
      <main className="console-main-content">
        {/* Success Alert Banner */}
        {successData && (
          <div className="success-alert-banner">
            <div>
              <strong>✓ Brand Successfully Registered & Persisted to PostgreSQL!</strong>
              <div style={{ marginTop: '4px', fontSize: '0.85rem', color: '#c8e6c9' }}>
                Brand: <strong>{successData.brand.name}</strong> (Slug: <code>{successData.brand.slug}</code>) | 
                Game: <strong>{successData.brand.gameName}</strong> | 
                Superadmins: <strong>{successData.superadmins?.length || 0}</strong> | 
                Admins: <strong>{successData.admins?.length || 0}</strong>
              </div>
            </div>
            <button 
              className="btn-cyber-secondary" 
              style={{ padding: '6px 14px', fontSize: '0.75rem' }}
              onClick={() => setActiveTab('brands')}
            >
              View in Catalog →
            </button>
          </div>
        )}

        {/* Global Error Alert */}
        {errorMsg && (
          <div className="error-alert-banner">
            ⚠ {errorMsg}
          </div>
        )}

        {activeTab === 'register' ? (
          <div className="cyber-card" style={{ maxWidth: '900px', margin: '0 auto' }}>
            {/* Visual Stepper */}
            <div className="stepper-container">
              <div 
                className={`step-item ${currentStep === 1 ? 'active' : currentStep > 1 ? 'completed' : ''}`}
                onClick={() => setCurrentStep(1)}
              >
                <div className="step-circle">{currentStep > 1 ? '✓' : '1'}</div>
                <div className="step-title-text">Brand & Game</div>
              </div>

              <div className={`step-connector-line ${currentStep >= 2 ? 'active' : ''}`}></div>

              <div 
                className={`step-item ${currentStep === 2 ? 'active' : currentStep > 2 ? 'completed' : ''}`}
                onClick={() => brandName.trim() && gameName.trim() && setCurrentStep(2)}
              >
                <div className="step-circle">{currentStep > 2 ? '✓' : '2'}</div>
                <div className="step-title-text">Superadmins</div>
              </div>

              <div className={`step-connector-line ${currentStep >= 3 ? 'active' : ''}`}></div>

              <div 
                className={`step-item ${currentStep === 3 ? 'active' : ''}`}
                onClick={() => brandName.trim() && gameName.trim() && setCurrentStep(3)}
              >
                <div className="step-circle">3</div>
                <div className="step-title-text">Normal Admins (Optional)</div>
              </div>
            </div>

            {/* STEP 1: BRAND & GAME DETAILS */}
            {currentStep === 1 && (
              <form onSubmit={handleNextToSuperadmins}>
                <div style={{ marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '1rem' }}>
                  <h3 style={{ fontSize: '1.2rem', color: 'var(--color-solar-lime)', marginBottom: '4px' }}>
                    Step 1: Brand & Game Credentials
                  </h3>
                  <p style={{ color: 'var(--color-gray)', fontSize: '0.85rem' }}>
                    Enter the client tenant brand name and their dedicated promotional game title.
                  </p>
                </div>

                <div className="form-grid-2">
                  <div className="form-group">
                    <label>Brand Name <span className="req">*</span></label>
                    <input 
                      type="text" 
                      className="form-control-input"
                      placeholder="e.g. Popular Electricals, Railrolls"
                      value={brandName}
                      onChange={(e) => setBrandName(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Game Title / Game Name <span className="req">*</span></label>
                    <input 
                      type="text" 
                      className="form-control-input"
                      placeholder="e.g. Sparky Run, Railrolls Dash"
                      value={gameName}
                      onChange={(e) => setGameName(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Brand Identifier Slug (Tenant Scoping)</label>
                  <input 
                    type="text" 
                    className="form-control-input"
                    placeholder="Auto-generated from brand name"
                    value={customSlug}
                    onChange={(e) => setCustomSlug(e.target.value)}
                  />
                  <div style={{ fontSize: '0.78rem', color: 'var(--color-gray)', marginTop: '6px' }}>
                    System Identifier: <span className="brand-slug-code">{previewSlug || 'pending...'}</span>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '2rem' }}>
                  <button type="submit" className="btn-cyber-primary">
                    Next: Setup Superadmin(s) →
                  </button>
                </div>
              </form>
            )}

            {/* STEP 2: SUPERADMINS SETUP */}
            {currentStep === 2 && (
              <form onSubmit={handleNextToAdmins}>
                <div style={{ marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '1rem' }}>
                  <h3 style={{ fontSize: '1.2rem', color: 'var(--color-solar-lime)', marginBottom: '4px' }}>
                    Step 2: Brand Superadmin(s)
                  </h3>
                  <p style={{ color: 'var(--color-gray)', fontSize: '0.85rem' }}>
                    Configure the primary superadmin operator(s) for <strong>{brandName}</strong> with full dashboard and tenant authority.
                  </p>
                </div>

                {superadmins.map((sa, idx) => (
                  <div key={idx} className="user-entry-card">
                    <div className="user-entry-card-header">
                      <span className="role-pill-badge super">Superadmin #{idx + 1}</span>
                      {superadmins.length > 1 && (
                        <button 
                          type="button" 
                          className="remove-user-btn"
                          onClick={() => handleRemoveSuperadmin(idx)}
                        >
                          ✕ Remove
                        </button>
                      )}
                    </div>

                    <div className="form-grid-2">
                      <div className="form-group" style={{ marginBottom: '0.8rem' }}>
                        <label>Username <span className="req">*</span></label>
                        <input 
                          type="text" 
                          className="form-control-input"
                          placeholder="e.g. popular_boss, rashid_admin"
                          value={sa.username}
                          onChange={(e) => handleUpdateSuperadmin(idx, 'username', e.target.value)}
                          required
                        />
                      </div>

                      <div className="form-group" style={{ marginBottom: '0.8rem' }}>
                        <label>Password <span className="req">*</span></label>
                        <input 
                          type="password" 
                          className="form-control-input"
                          placeholder="Min 6 characters"
                          value={sa.password}
                          onChange={(e) => handleUpdateSuperadmin(idx, 'password', e.target.value)}
                          required
                        />
                      </div>
                    </div>

                    <div className="form-group" style={{ marginBottom: '0' }}>
                      <label>Full Display Name (Optional)</label>
                      <input 
                        type="text" 
                        className="form-control-input"
                        placeholder="e.g. Rashid Al-Hajri"
                        value={sa.name}
                        onChange={(e) => handleUpdateSuperadmin(idx, 'name', e.target.value)}
                      />
                    </div>
                  </div>
                ))}

                <button 
                  type="button" 
                  className="btn-add-repeater"
                  onClick={handleAddSuperadmin}
                >
                  + Add Another Superadmin for this Brand
                </button>

                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2rem' }}>
                  <button 
                    type="button" 
                    className="btn-cyber-secondary"
                    onClick={() => setCurrentStep(1)}
                  >
                    ← Back to Brand Info
                  </button>
                  <button type="submit" className="btn-cyber-primary">
                    Next: Add Normal Admins (Optional) →
                  </button>
                </div>
              </form>
            )}

            {/* STEP 3: OPTIONAL NORMAL ADMINS */}
            {currentStep === 3 && (
              <form onSubmit={handleSubmitRegistration}>
                <div style={{ marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '1rem' }}>
                  <h3 style={{ fontSize: '1.2rem', color: 'var(--color-cyan)', marginBottom: '4px' }}>
                    Step 3: Normal Admin Operators (Optional)
                  </h3>
                  <p style={{ color: 'var(--color-gray)', fontSize: '0.85rem' }}>
                    Optionally provision standard team members for <strong>{brandName}</strong> with Email & Password.
                  </p>
                </div>

                {admins.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '2rem', background: 'rgba(6,13,22,0.4)', borderRadius: '6px', marginBottom: '1.5rem' }}>
                    <p style={{ color: 'var(--color-gray)', fontSize: '0.9rem', marginBottom: '1rem' }}>
                      No normal admins added yet. Superadmins are already ready.
                    </p>
                    <button 
                      type="button" 
                      className="btn-cyber-secondary"
                      onClick={handleAddAdmin}
                    >
                      + Add Normal Admin with Email & Password
                    </button>
                  </div>
                ) : (
                  <>
                    {admins.map((ad, idx) => (
                      <div key={idx} className="user-entry-card normal-admin">
                        <div className="user-entry-card-header">
                          <span className="role-pill-badge admin">Normal Admin #{idx + 1}</span>
                          <button 
                            type="button" 
                            className="remove-user-btn"
                            onClick={() => handleRemoveAdmin(idx)}
                          >
                            ✕ Remove
                          </button>
                        </div>

                        <div className="form-grid-2">
                          <div className="form-group" style={{ marginBottom: '0.8rem' }}>
                            <label>Admin Email Address <span className="req">*</span></label>
                            <input 
                              type="email" 
                              className="form-control-input"
                              placeholder="operator@popular.com"
                              value={ad.email}
                              onChange={(e) => handleUpdateAdmin(idx, 'email', e.target.value)}
                              required
                            />
                          </div>

                          <div className="form-group" style={{ marginBottom: '0.8rem' }}>
                            <label>Password <span className="req">*</span></label>
                            <input 
                              type="password" 
                              className="form-control-input"
                              placeholder="Min 6 characters"
                              value={ad.password}
                              onChange={(e) => handleUpdateAdmin(idx, 'password', e.target.value)}
                              required
                            />
                          </div>
                        </div>

                        <div className="form-grid-2" style={{ marginTop: '0.4rem' }}>
                          <div className="form-group" style={{ marginBottom: '0' }}>
                            <label>Full Name</label>
                            <input 
                              type="text" 
                              className="form-control-input"
                              placeholder="e.g. John Doe"
                              value={ad.name}
                              onChange={(e) => handleUpdateAdmin(idx, 'name', e.target.value)}
                            />
                          </div>
                          <div className="form-group" style={{ marginBottom: '0' }}>
                            <label>Username (Optional)</label>
                            <input 
                              type="text" 
                              className="form-control-input"
                              placeholder="e.g. john_staff"
                              value={ad.username}
                              onChange={(e) => handleUpdateAdmin(idx, 'username', e.target.value)}
                            />
                          </div>
                        </div>
                      </div>
                    ))}

                    <button 
                      type="button" 
                      className="btn-add-repeater"
                      style={{ borderColor: 'rgba(0, 255, 249, 0.4)', color: 'var(--color-cyan)', background: 'rgba(0, 255, 249, 0.08)' }}
                      onClick={handleAddAdmin}
                    >
                      + Add Another Admin
                    </button>
                  </>
                )}

                {/* Summary Card */}
                <div style={{ marginTop: '2rem', padding: '1rem', background: 'rgba(6,13,22,0.8)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '6px' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--color-gray)', marginBottom: '6px' }}>REGISTRATION MANIFEST SUMMARY:</div>
                  <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', fontSize: '0.85rem' }}>
                    <div>Brand: <strong style={{ color: 'var(--color-white)' }}>{brandName}</strong></div>
                    <div>Game: <strong style={{ color: 'var(--color-cyan)' }}>{gameName}</strong></div>
                    <div>Superadmins: <strong style={{ color: 'var(--color-solar-lime)' }}>{superadmins.length} configured</strong></div>
                    <div>Admins: <strong style={{ color: 'var(--color-cyan)' }}>{admins.filter(a => a.email).length} configured</strong></div>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2rem' }}>
                  <button 
                    type="button" 
                    className="btn-cyber-secondary"
                    onClick={() => setCurrentStep(2)}
                  >
                    ← Back to Superadmins
                  </button>
                  <button 
                    type="submit" 
                    className="btn-cyber-primary"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? 'Registering to Database...' : '⚡ Complete & Register Brand'}
                  </button>
                </div>
              </form>
            )}
          </div>
        ) : (
          /* BRANDS CATALOG TAB */
          <div className="cyber-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <div>
                <h2 style={{ fontSize: '1.3rem', color: 'var(--color-white)' }}>Registered Brand Tenants</h2>
                <p style={{ color: 'var(--color-gray)', fontSize: '0.85rem', marginTop: '4px' }}>
                  Live multi-tenant brands stored in PostgreSQL with their dedicated games and admin teams.
                </p>
              </div>
              <button 
                className="btn-cyber-secondary" 
                onClick={fetchBrands}
                disabled={isLoadingBrands}
              >
                {isLoadingBrands ? 'Refreshing...' : '↻ Refresh Data'}
              </button>
            </div>

            {isLoadingBrands ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-gray)' }}>
                Loading brands from database...
              </div>
            ) : brandsList.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-gray)' }}>
                No brands registered yet. Use the "Register Brand" tab to onboard your first client!
              </div>
            ) : (
              <div className="brand-table-wrapper">
                <table className="cyber-table">
                  <thead>
                    <tr>
                      <th>Brand</th>
                      <th>Game Title</th>
                      <th>Tenant Slug</th>
                      <th>Administrators</th>
                      <th>Activity Metrics</th>
                      <th>Registered</th>
                    </tr>
                  </thead>
                  <tbody>
                    {brandsList.map((brand) => (
                      <tr key={brand.id}>
                        <td>
                          <div className="brand-title-badge">
                            <span style={{ color: 'var(--color-solar-lime)' }}>■</span>
                            {brand.name}
                          </div>
                        </td>
                        <td>
                          <span className="game-title-pill">
                            🎮 {brand.gameName || 'Not Set'}
                          </span>
                        </td>
                        <td>
                          <span className="brand-slug-code">{brand.slug}</span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {brand.admins && brand.admins.length > 0 ? (
                              brand.admins.map((adm) => (
                                <div key={adm.id} style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <span className={`role-pill-badge ${adm.role === 'SUPERADMIN' ? 'super' : 'admin'}`} style={{ padding: '2px 6px', fontSize: '0.65rem' }}>
                                    {adm.role}
                                  </span>
                                  <span style={{ color: 'var(--color-white)' }}>
                                    {adm.username || adm.email}
                                  </span>
                                </div>
                              ))
                            ) : (
                              <span style={{ color: 'var(--color-muted)', fontSize: '0.8rem' }}>No admins assigned</span>
                            )}
                          </div>
                        </td>
                        <td>
                          <div style={{ fontSize: '0.8rem', color: 'var(--color-gray)' }}>
                            Tokens: <strong style={{ color: 'var(--color-white)' }}>{brand._count?.tokens || 0}</strong> | 
                            Plays: <strong style={{ color: 'var(--color-white)' }}>{brand._count?.sessions || 0}</strong>
                          </div>
                        </td>
                        <td style={{ fontSize: '0.8rem', color: 'var(--color-muted)' }}>
                          {new Date(brand.createdAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
