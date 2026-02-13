import { useState, useEffect } from 'react';
import { Route, Switch, Link, useLocation } from 'wouter';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import StockManagement from './pages/StockManagement';
import SkuMapping from './pages/SkuMapping';
import TransactionHistory from './pages/TransactionHistory';
import UserManagement from './pages/UserManagement';
import ProductManagement from './pages/ProductManagement';

import BOMViewer from './pages/BOMViewer';
import Attachments from './pages/Attachments';

function App() {
  const [user, setUser] = useState(null);
  const [location, setLocation] = useLocation();

  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
  }, []);

  const handleLogin = (userData) => {
    setUser(userData);
    localStorage.setItem('user', JSON.stringify(userData));
    setLocation('/');
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('user');
    setLocation('/login');
  };

  if (!user && location !== '/login') {
    return <Login onLogin={handleLogin} />;
  }

  if (location === '/login' && user) {
    setLocation('/');
    return null;
  }

  return (
    <div>
      {user && (
        <nav className="nav">
          <div className="nav-container">
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <img src="/logo.png" alt="Logo" style={{ width: '48px', height: '48px', objectFit: 'contain' }} />
              <h1 style={{ fontSize: '20px', fontWeight: '900', color: '#2563eb', fontFamily: 'Archivo Black, sans-serif', letterSpacing: '-0.02em' }}>
                SCENT STOCK MANAGER
              </h1>
            </div>
            <ul className="nav-links">
              <li><Link href="/">Dashboard</Link></li>
              <li><Link href="/products">Products</Link></li>
              <li><Link href="/stock">Stock Management</Link></li>

              <li><Link href="/bom">BOM</Link></li>
              <li><Link href="/sku-mapping">SKU Mapping</Link></li>
              <li><Link href="/attachments">Attachments</Link></li>
              <li><Link href="/history">History</Link></li>
              {user.role === 'admin' && (
                <li><Link href="/users">Users</Link></li>
              )}
              <li>
                <button onClick={handleLogout} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', fontWeight: '500' }}>
                  Logout
                </button>
              </li>
            </ul>
          </div>
        </nav>
      )}

      <Switch>
        <Route path="/login">
          <Login onLogin={handleLogin} />
        </Route>
        <Route path="/">
          <Dashboard />
        </Route>
        <Route path="/products">
          <ProductManagement user={user} />
        </Route>
        <Route path="/stock">
          <StockManagement />
        </Route>

        <Route path="/bom">
          <BOMViewer user={user} />
        </Route>
        <Route path="/sku-mapping">
          <SkuMapping />
        </Route>
        <Route path="/attachments">
          <Attachments />
        </Route>
        <Route path="/history">
          <TransactionHistory />
        </Route>
        <Route path="/users">
          <UserManagement />
        </Route>
      </Switch>
    </div>
  );
}

export default App;
