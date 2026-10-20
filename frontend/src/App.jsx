import { useState } from 'react'
import Login from './Login'
import CreateAccount from './CreateAccount'
import Dashboard from './Dashboard'
import RailrollsPortal from './RailrollsPortal'
import './index.css'

function App() {
  const [isLogin, setIsLogin] = useState(true)
  const [user, setUser] = useState(null)
  const [currentView, setCurrentView] = useState('hub') // 'hub' or 'railrolls'

  const toggleForm = () => {
    setIsLogin(!isLogin)
  }

  const handleLogin = (userData) => {
    setUser(userData)
    setCurrentView('hub')
  }

  const handleLogout = () => {
    setUser(null)
    setCurrentView('hub')
  }

  return (
    <div className="app-container">
      {user ? (
        currentView === 'railrolls' ? (
          <RailrollsPortal 
            currentUser={user} 
            onBackToDashboard={() => setCurrentView('hub')} 
          />
        ) : (
          <Dashboard 
            user={user} 
            onLogout={handleLogout} 
            onOpenRailrolls={() => setCurrentView('railrolls')} 
          />
        )
      ) : isLogin ? (
        <Login toggleForm={toggleForm} onLogin={handleLogin} />
      ) : (
        <CreateAccount toggleForm={toggleForm} onLogin={handleLogin} />
      )}
    </div>
  )
}

export default App
