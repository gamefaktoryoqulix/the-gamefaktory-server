import React, { useState, useEffect } from 'react';

// Environment configurations
const ENV_CONFIGS = {
  dev: {
    name: 'DEV (Local)',
    apiUrl: 'http://localhost:5000',
    color: '#B6FF3B',
    badgeText: 'LOCAL DEV (5000)'
  },
  prod: {
    name: 'PROD (Cloud)',
    apiUrl: 'https://api.gamefaktory.com',
    color: '#00fff9',
    badgeText: 'PROD (api.gamefaktory.com)'
  }
};

// Standard Clean SVG Icons (replacing all emojis with precision UI icons)
const Icons = {
  Building: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
      <path d="M9 22v-4h6v4" />
      <path d="M8 6h.01M16 6h.01M8 10h.01M16 10h.01M8 14h.01M16 14h.01" />
    </svg>
  ),
  Gamepad: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="6" y1="12" x2="10" y2="12" />
      <line x1="8" y1="10" x2="8" y2="14" />
      <line x1="15" y1="13" x2="15.01" y2="13" />
      <line x1="18" y1="11" x2="18.01" y2="11" />
      <rect x="2" y="6" width="20" height="12" rx="2" />
    </svg>
  ),
  Shield: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  ),
  Ticket: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2z" />
      <path d="M13 5v2M13 11v2M13 17v2" />
    </svg>
  ),
  Grid: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
    </svg>
  ),
  Plus: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  ),
  Refresh: ({ spinning }) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: spinning ? 'spin 1s linear infinite' : 'none' }}>
      <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
    </svg>
  ),
  ExternalLink: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  ),
  Check: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  AlertTriangle: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
  ArrowRight: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  ),
  ArrowLeft: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  ),
  Lightning: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  ),
  Trash: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  ),
  Users: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  Key: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 2l-2 2m-1.5 1.5L14 9l-1.5-1.5" />
      <circle cx="7.5" cy="15.5" r="5.5" />
      <path d="M16 8l5-5" />
    </svg>
  ),
  Mail: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <polyline points="22,6 12,13 2,6" />
    </svg>
  ),
  Phone: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  )
};


export default function CoreAdminConsole() {
  // Read initial env from localStorage or default to 'dev'
  const [currentEnv, setCurrentEnv] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('gf_admin_env') || 'dev';
    }
    return 'dev';
  });

  const activeConfig = ENV_CONFIGS[currentEnv] || ENV_CONFIGS.dev;
  const API_BASE_URL = activeConfig.apiUrl;

  const handleToggleEnv = (envKey) => {
    setCurrentEnv(envKey);
    if (typeof window !== 'undefined') {
      localStorage.setItem('gf_admin_env', envKey);
    }
    setErrorMsg('');
    setSuccessData(null);
  };

  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard' | 'register'
  const [currentStep, setCurrentStep] = useState(1); // 1: Brand Info, 2: Superadmins, 3: Normal Admins (Optional)
  
  // Brand Detail Modal / Drawer View
  const [selectedBrand, setSelectedBrand] = useState(null);
  const [brandDetailTab, setBrandDetailTab] = useState('overview'); // 'overview' | 'users'
  const [brandPlayers, setBrandPlayers] = useState([]);
  const [isLoadingPlayers, setIsLoadingPlayers] = useState(false);
  const [playersError, setPlayersError] = useState('');
  
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

  // Fetch Users / Players for a specific brand
  const fetchBrandPlayers = async (brandSlug) => {
    setIsLoadingPlayers(true);
    setPlayersError('');
    try {
      const res = await fetch(`${API_BASE_URL}/api/brands/${brandSlug}/players`);
      const data = await res.json();
      if (data.success) {
        setBrandPlayers(data.players || []);
      } else {
        setPlayersError(data.error || 'Failed to load players for this brand');
      }
    } catch (err) {
      console.error('Fetch players error:', err);
      setPlayersError('Network error while loading players');
    } finally {
      setIsLoadingPlayers(false);
    }
  };

  const handleOpenBrandDetails = (brand) => {
    setSelectedBrand(brand);
    setBrandDetailTab('overview');
    setBrandPlayers([]);
    fetchBrandPlayers(brand.slug);
  };

  const handleCloseBrandDetails = () => {
    setSelectedBrand(null);
  };

  // Delete Single Brand
  const handleDeleteBrand = async (brandId, brandName) => {
    if (!window.confirm(`Are you sure you want to delete "${brandName}"? All its tokens, sessions, and administrators will be removed.`)) {
      return;
    }
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/brands/${brandId}`, { method: 'DELETE' });
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        const text = await res.text();
        if (res.status === 404) {
          alert(`Error (404): The server at ${API_BASE_URL} does not have the DELETE endpoint yet. Please trigger a "Redeploy" in Coolify to apply the latest server update.`);
        } else {
          alert(`Server returned an error (${res.status}): ${text.slice(0, 150)}`);
        }
        return;
      }
      const data = await res.json();
      if (data.success) {
        fetchBrands();
      } else {
        alert(data.error || 'Failed to delete brand');
      }
    } catch (err) {
      console.error('Delete brand error:', err);
      alert(`Network error while deleting brand: ${err.message}`);
    }
  };

  // Reset Entire Database
  const handleResetAllBrands = async () => {
    if (!window.confirm(`DANGER: Are you sure you want to wipe ALL brands and records in ${activeConfig.name}? This gives you a 100% clean slate to onboard fresh.`)) {
      return;
    }
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/brands/reset-all`, { method: 'POST' });
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        const text = await res.text();
        if (res.status === 404) {
          alert(`Error (404): The server at ${API_BASE_URL} does not have the reset endpoint yet. Please trigger a "Redeploy" in Coolify to apply the latest server update.`);
        } else {
          alert(`Server returned an error (${res.status}): ${text.slice(0, 150)}`);
        }
        return;
      }
      const data = await res.json();
      if (data.success) {
        fetchBrands();
      } else {
        alert(data.error || 'Failed to reset database');
      }
    } catch (err) {
      console.error('Reset error:', err);
      alert(`Network error while resetting: ${err.message}`);
    }
  };

  useEffect(() => {
    fetchBrands();
  }, [currentEnv]);

  useEffect(() => {
    if (activeTab === 'dashboard') {
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
            className={`nav-tab-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => { setActiveTab('dashboard'); setSuccessData(null); }}
          >
            <Icons.Grid />
            <span>Brand Dashboard</span>
          </button>
          <button 
            className={`nav-tab-btn ${activeTab === 'register' ? 'active' : ''}`}
            onClick={() => { setActiveTab('register'); setSuccessData(null); }}
          >
            <Icons.Plus />
            <span>Register Brand</span>
          </button>
        </nav>

        {/* Dev / Prod Environment Switcher */}
        <div className="env-switcher-group">
          <div className="env-switcher-toggle">
            <button
              type="button"
              className={`env-toggle-btn ${currentEnv === 'dev' ? 'active-dev' : ''}`}
              onClick={() => handleToggleEnv('dev')}
              title="Target local development server (http://localhost:5000)"
            >
              <span className="env-dot env-dot-dev"></span>
              DEV
            </button>
            <button
              type="button"
              className={`env-toggle-btn ${currentEnv === 'prod' ? 'active-prod' : ''}`}
              onClick={() => handleToggleEnv('prod')}
              title="Target live production server (https://api.gamefaktory.com)"
            >
              <span className="env-dot env-dot-prod"></span>
              PROD
            </button>
          </div>

          <div className={`header-status-badge env-status-${currentEnv}`}>
            <div className={`status-dot-pulse pulse-${currentEnv}`}></div>
            <span>{activeConfig.badgeText}</span>
          </div>
        </div>
      </header>

      {/* Main Workspace Area */}
      <main className="console-main-content">
        {/* Success Alert Banner */}
        {successData && (
          <div className="success-alert-banner">
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Icons.Check />
                <strong>Brand Successfully Registered & Persisted to PostgreSQL!</strong>
              </div>
              <div style={{ marginTop: '4px', fontSize: '0.85rem', color: '#c8e6c9' }}>
                Brand: <strong>{successData.brand.name}</strong> (Slug: <code>{successData.brand.slug}</code>) | 
                Game: <strong>{successData.brand.gameName}</strong> | 
                Superadmins: <strong>{successData.superadmins?.length || 0}</strong> | 
                Admins: <strong>{successData.admins?.length || 0}</strong>
              </div>
            </div>
            <button 
              className="btn-cyber-secondary" 
              style={{ padding: '6px 14px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '6px' }}
              onClick={() => setActiveTab('dashboard')}
            >
              <span>Back to Dashboard</span>
              <Icons.ArrowRight />
            </button>
          </div>
        )}

        {/* Global Error Alert */}
        {errorMsg && (
          <div className="error-alert-banner" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Icons.AlertTriangle />
            <span>{errorMsg}</span>
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
                    style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                  >
                    <Icons.Lightning />
                    <span>{isSubmitting ? 'Registering to Database...' : 'Complete & Register Brand'}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        ) : (
          /* BRAND DASHBOARD VIEW */
          <div>
            {/* Hero Section with Prominent Add Brand Button */}
            <div className="dashboard-hero-section">
              <div className="dashboard-hero-title">
                <h1>
                  <Icons.Lightning />
                  <span>BRAND ECOSYSTEM DASHBOARD</span>
                </h1>
                <p>
                  Centralized command console for active brand tenants, assigned administrators, games, and telemetry metrics.
                </p>
              </div>

              <div className="dashboard-hero-actions">
                <button 
                  className="btn-cyber-secondary" 
                  onClick={fetchBrands}
                  disabled={isLoadingBrands}
                  title="Reload brand rosters and live metrics"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <Icons.Refresh spinning={isLoadingBrands} />
                  <span>{isLoadingBrands ? 'Refreshing...' : 'Refresh'}</span>
                </button>
                {brandsList.length > 0 && (
                  <button 
                    className="btn-cyber-secondary" 
                    onClick={handleResetAllBrands}
                    style={{ borderColor: 'rgba(255, 75, 75, 0.4)', color: '#ff6b6b', display: 'flex', alignItems: 'center', gap: '6px' }}
                    title="Wipe all brands and records for a completely clean slate"
                  >
                    <Icons.Trash />
                    <span>Reset All</span>
                  </button>
                )}
                <button
                  className="btn-add-brand-prominent"
                  onClick={() => { setActiveTab('register'); setCurrentStep(1); }}
                >
                  <Icons.Plus />
                  <span>REGISTER NEW BRAND</span>
                </button>
              </div>
            </div>

            {/* Quick Overview Metrics Strip */}
            <div className="dashboard-metrics-strip">
              <div className="metric-strip-card">
                <div className="metric-icon-box" style={{ color: 'var(--color-solar-lime)' }}>
                  <Icons.Building />
                </div>
                <div className="metric-strip-info">
                  <div className="metric-num">{brandsList.length}</div>
                  <div className="metric-label">Active Brands</div>
                </div>
              </div>

              <div className="metric-strip-card">
                <div className="metric-icon-box" style={{ color: 'var(--color-cyan)' }}>
                  <Icons.Gamepad />
                </div>
                <div className="metric-strip-info">
                  <div className="metric-num">
                    {brandsList.filter(b => b.gameName).length}
                  </div>
                  <div className="metric-label">Live Games</div>
                </div>
              </div>

              <div className="metric-strip-card">
                <div className="metric-icon-box" style={{ color: 'var(--color-magenta)' }}>
                  <Icons.Shield />
                </div>
                <div className="metric-strip-info">
                  <div className="metric-num">
                    {brandsList.reduce((acc, b) => acc + (b.admins?.length || 0), 0)}
                  </div>
                  <div className="metric-label">Authorized Admins</div>
                </div>
              </div>

              <div className="metric-strip-card">
                <div className="metric-icon-box" style={{ color: 'var(--color-amber)' }}>
                  <Icons.Ticket />
                </div>
                <div className="metric-strip-info">
                  <div className="metric-num">
                    {brandsList.reduce((acc, b) => acc + (b._count?.tokens || 0), 0)}
                  </div>
                  <div className="metric-label">QR Tokens Issued</div>
                </div>
              </div>
            </div>

            {/* Brands Cards Grid */}
            {isLoadingBrands ? (
              <div className="empty-brands-panel">
                <div className="status-dot-pulse" style={{ margin: '0 auto 12px auto' }}></div>
                <h3>Loading Brands from {activeConfig.badgeText}...</h3>
                <p>Retrieving multi-tenant rosters and telemetry data.</p>
              </div>
            ) : brandsList.length === 0 ? (
              <div className="empty-brands-panel">
                <div style={{ color: 'var(--color-gray)', marginBottom: '12px', display: 'flex', justifyContent: 'center' }}>
                  <Icons.Building />
                </div>
                <h3>No Brands Found in {activeConfig.name}</h3>
                <p>Get started by registering your first retail client, assigning games, and creating superadmin accounts.</p>
                <button
                  className="btn-add-brand-prominent"
                  style={{ display: 'inline-flex' }}
                  onClick={() => { setActiveTab('register'); setCurrentStep(1); }}
                >
                  <Icons.Plus />
                  <span>Register First Brand</span>
                </button>
              </div>
            ) : (
              <div className="brand-cards-grid">
                {brandsList.map((brand) => (
                  <div 
                    key={brand.id} 
                    className="brand-card-item clickable-brand-card"
                    onClick={() => handleOpenBrandDetails(brand)}
                    title={`Click to view ${brand.name} overview, credentials, and registered players`}
                  >
                    <div>
                      {/* Brand Card Top Header */}
                      <div className="brand-card-header">
                        <div className="brand-card-title">
                          <h3>{brand.name}</h3>
                          <span className="brand-card-slug">{brand.slug}</span>
                        </div>
                        <span className="brand-game-badge">
                          <Icons.Gamepad />
                          <span>{brand.gameName || 'Sparky Run'}</span>
                        </span>
                      </div>

                      {/* Brand Administrators Preview */}
                      <div className="brand-card-body">
                        <div className="brand-card-admins-list">
                          <div className="section-title">ADMINISTRATOR ROSTER:</div>
                          {brand.admins && brand.admins.length > 0 ? (
                            brand.admins.slice(0, 3).map((adm) => (
                              <div key={adm.id} className="admin-entry">
                                <span style={{ color: 'var(--color-white)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '200px' }}>
                                  {adm.name || adm.username || adm.email}
                                </span>
                                <span className={`role-pill-badge ${adm.role === 'SUPERADMIN' ? 'super' : 'admin'}`}>
                                  {adm.role}
                                </span>
                              </div>
                            ))
                          ) : (
                            <div style={{ color: 'var(--color-muted)', fontSize: '0.78rem' }}>
                              No admins assigned
                            </div>
                          )}
                          {brand.admins && brand.admins.length > 3 && (
                            <div style={{ fontSize: '0.7rem', color: 'var(--color-gray)', marginTop: '4px', textAlign: 'right' }}>
                              +{brand.admins.length - 3} more admin{brand.admins.length - 3 > 1 ? 's' : ''}
                            </div>
                          )}
                        </div>

                        {/* Activity Metrics Counters */}
                        <div className="brand-card-stats-grid">
                          <div className="brand-stat-box">
                            <div className="val">{brand._count?.tokens || 0}</div>
                            <div className="lbl">Tokens</div>
                          </div>
                          <div className="brand-stat-box">
                            <div className="val">{brand._count?.sessions || 0}</div>
                            <div className="lbl">Plays</div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Brand Card Footer */}
                    <div className="brand-card-footer">
                      <span>Joined {new Date(brand.createdAt).toLocaleDateString()}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button
                          type="button"
                          className="btn-card-delete"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteBrand(brand.id, brand.name);
                          }}
                          title={`Delete ${brand.name} from database`}
                        >
                          <Icons.Trash />
                          <span>Delete</span>
                        </button>
                        <button 
                          className="btn-card-launch"
                          onClick={(e) => {
                            e.stopPropagation();
                            window.open(`/?brand=${brand.slug}`, '_blank');
                          }}
                          title={`Open dedicated brand view for ${brand.slug}`}
                        >
                          <span>Launch</span>
                          <Icons.ExternalLink />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Brand Detail Modal: Overview & Users Tabs */}
        {selectedBrand && (
          <div className="brand-modal-overlay" onClick={handleCloseBrandDetails}>
            <div className="brand-modal-content" onClick={(e) => e.stopPropagation()}>
              {/* Modal Header */}
              <div className="brand-modal-header">
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <h2>{selectedBrand.name}</h2>
                    <span className="brand-game-badge">
                      <Icons.Gamepad />
                      <span>{selectedBrand.gameName || 'Sparky Run'}</span>
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '6px' }}>
                    <span className="brand-card-slug">{selectedBrand.slug}</span>
                    <span style={{ fontSize: '0.78rem', color: 'var(--color-muted)' }}>
                      ID: <code>{selectedBrand.id}</code>
                    </span>
                  </div>
                </div>
                <button className="brand-modal-close-btn" onClick={handleCloseBrandDetails} title="Close View">
                  ✕
                </button>
              </div>

              {/* Navigation Tabs */}
              <div className="brand-modal-tabs">
                <button
                  type="button"
                  className={`modal-tab-btn ${brandDetailTab === 'overview' ? 'active' : ''}`}
                  onClick={() => setBrandDetailTab('overview')}
                >
                  <Icons.Building />
                  <span>Overview & Admins</span>
                </button>
                <button
                  type="button"
                  className={`modal-tab-btn ${brandDetailTab === 'users' ? 'active' : ''}`}
                  onClick={() => setBrandDetailTab('users')}
                >
                  <Icons.Users />
                  <span>Users / Players ({brandPlayers.length})</span>
                </button>
              </div>

              {/* Modal Body */}
              <div className="brand-modal-body">
                {/* TAB 1: OVERVIEW */}
                {brandDetailTab === 'overview' && (
                  <div>
                    {/* Metrics Overview Cards */}
                    <div className="brand-card-stats-grid" style={{ marginBottom: '1.75rem', gridTemplateColumns: 'repeat(4, 1fr)' }}>
                      <div className="brand-stat-box">
                        <div className="val">{selectedBrand._count?.tokens || 0}</div>
                        <div className="lbl">Tokens Issued</div>
                      </div>
                      <div className="brand-stat-box">
                        <div className="val">{selectedBrand._count?.sessions || 0}</div>
                        <div className="lbl">Total Plays</div>
                      </div>
                      <div className="brand-stat-box">
                        <div className="val">{selectedBrand.admins?.length || 0}</div>
                        <div className="lbl">Administrators</div>
                      </div>
                      <div className="brand-stat-box">
                        <div className="val">{brandPlayers.length}</div>
                        <div className="lbl">Registered Players</div>
                      </div>
                    </div>

                    {/* API Keys & Webhook Config */}
                    <div className="detail-section-block">
                      <div className="section-title">
                        <Icons.Key />
                        <span>INTEGRATION CREDENTIALS & SECRETS</span>
                      </div>
                      <div className="credential-row">
                        <span className="cred-label">API Key:</span>
                        <code className="cred-val">{selectedBrand.apiKey || `gf_live_${selectedBrand.slug}_key`}</code>
                      </div>
                      <div className="credential-row">
                        <span className="cred-label">Webhook Secret:</span>
                        <code className="cred-val">{selectedBrand.webhookSecret || `gf_whsec_${selectedBrand.slug}_secret`}</code>
                      </div>
                      <div className="credential-row">
                        <span className="cred-label">Public Launch URL:</span>
                        <code className="cred-val" style={{ color: 'var(--color-solar-lime)' }}>
                          {window.location.origin}/?brand={selectedBrand.slug}
                        </code>
                      </div>
                    </div>

                    {/* Admin Roster Section */}
                    <div className="detail-section-block">
                      <div className="section-title">
                        <Icons.Shield />
                        <span>ASSIGNED ADMINISTRATORS & CREDENTIALS</span>
                      </div>
                      {selectedBrand.admins && selectedBrand.admins.length > 0 ? (
                        <div className="admins-table-wrapper">
                          <table className="cyber-table">
                            <thead>
                              <tr>
                                <th>Name / Username</th>
                                <th>Email / Identifier</th>
                                <th>Role</th>
                                <th>Created</th>
                              </tr>
                            </thead>
                            <tbody>
                              {selectedBrand.admins.map((adm) => (
                                <tr key={adm.id}>
                                  <td>
                                    <strong>{adm.name || adm.username}</strong>
                                    {adm.username && <div style={{ fontSize: '0.75rem', color: 'var(--color-gray)' }}>@{adm.username}</div>}
                                  </td>
                                  <td>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                      <Icons.Mail />
                                      <span>{adm.email || 'N/A'}</span>
                                    </div>
                                  </td>
                                  <td>
                                    <span className={`role-pill-badge ${adm.role === 'SUPERADMIN' ? 'super' : 'admin'}`}>
                                      {adm.role}
                                    </span>
                                  </td>
                                  <td>{new Date(adm.createdAt).toLocaleDateString()}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="empty-sub-panel">No administrators currently assigned to this brand.</div>
                      )}
                    </div>
                  </div>
                )}

                {/* TAB 2: USERS / PLAYERS */}
                {brandDetailTab === 'users' && (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                      <div style={{ fontSize: '0.85rem', color: 'var(--color-gray)' }}>
                        Players who have registered, claimed tokens, or completed gameplay sessions under <strong>{selectedBrand.name}</strong>.
                      </div>
                      <button
                        type="button"
                        className="btn-cyber-secondary"
                        style={{ padding: '4px 12px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                        onClick={() => fetchBrandPlayers(selectedBrand.slug)}
                        disabled={isLoadingPlayers}
                      >
                        <Icons.Refresh spinning={isLoadingPlayers} />
                        <span>{isLoadingPlayers ? 'Refreshing...' : 'Refresh Users'}</span>
                      </button>
                    </div>

                    {isLoadingPlayers ? (
                      <div className="empty-sub-panel" style={{ padding: '3rem' }}>
                        <div className="status-dot-pulse" style={{ margin: '0 auto 10px auto' }}></div>
                        <div>Loading brand players from {activeConfig.badgeText}...</div>
                      </div>
                    ) : playersError ? (
                      <div className="error-alert-banner" style={{ margin: '1rem 0' }}>
                        <Icons.AlertTriangle />
                        <span>{playersError}</span>
                      </div>
                    ) : brandPlayers.length === 0 ? (
                      <div className="empty-sub-panel" style={{ padding: '3rem' }}>
                        <div style={{ color: 'var(--color-gray)', marginBottom: '8px' }}>
                          <Icons.Users />
                        </div>
                        <h4 style={{ color: 'var(--color-white)', marginBottom: '4px' }}>No Players Yet for {selectedBrand.name}</h4>
                        <p style={{ color: 'var(--color-muted)', fontSize: '0.85rem', margin: 0 }}>
                          Players will automatically appear here as soon as they scan a QR code, register, or play a game.
                        </p>
                      </div>
                    ) : (
                      <div className="admins-table-wrapper">
                        <table className="cyber-table">
                          <thead>
                            <tr>
                              <th>Player Name</th>
                              <th>Phone Number</th>
                              <th>Games Played</th>
                              <th>Best Score</th>
                              <th>Total Score</th>
                              <th>Location / Showroom</th>
                            </tr>
                          </thead>
                          <tbody>
                            {brandPlayers.map((player) => (
                              <tr key={player.id}>
                                <td>
                                  <strong>{player.name || 'Sparky Runner'}</strong>
                                  <div style={{ fontSize: '0.7rem', color: 'var(--color-muted)' }}>ID: {player.id.slice(0, 8)}...</div>
                                </td>
                                <td>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-cyan)' }}>
                                    <Icons.Phone />
                                    <span>{player.fullPhone || player.phone || 'N/A'}</span>
                                  </div>
                                </td>
                                <td>
                                  <span style={{ fontWeight: 'bold', color: 'var(--color-white)' }}>
                                    {player.gamesPlayed || 0}
                                  </span>
                                </td>
                                <td>
                                  <span style={{ color: 'var(--color-solar-lime)', fontWeight: 'bold' }}>
                                    {player.bestScore || 0}
                                  </span>
                                </td>
                                <td>
                                  <span style={{ color: 'var(--color-amber)', fontWeight: 'bold' }}>
                                    {player.totalScore || 0}
                                  </span>
                                </td>
                                <td>
                                  <span style={{ fontSize: '0.8rem', color: 'var(--color-gray)' }}>
                                    {player.showroom || 'Showroom'}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
