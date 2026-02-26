import { useState, useEffect } from 'react';
import { exportToShopifyCSV, exportLowStockToShopifyCSV } from '../utils/shopifyExport';

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [watchlist, setWatchlist] = useState([]);
  const [showWatchlistModal, setShowWatchlistModal] = useState(false);

  useEffect(() => {
    fetchData();
    loadWatchlist();
  }, []);

  const fetchData = async () => {
    try {
      const [dashRes, productsRes] = await Promise.all([
        fetch('/api/dashboard'),
        fetch('/api/products')
      ]);
      
      const dashData = await dashRes.json();
      const productsData = await productsRes.json();
      
      setData(dashData);
      setProducts(productsData);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadWatchlist = () => {
    try {
      const saved = localStorage.getItem('priority_watchlist');
      if (saved) {
        setWatchlist(JSON.parse(saved));
      }
    } catch (error) {
      console.error('Error loading watchlist:', error);
    }
  };

  const saveWatchlist = (newWatchlist) => {
    try {
      localStorage.setItem('priority_watchlist', JSON.stringify(newWatchlist));
      setWatchlist(newWatchlist);
    } catch (error) {
      console.error('Error saving watchlist:', error);
    }
  };

  const addToWatchlist = (productId) => {
    if (watchlist.length >= 10) {
      alert('You can only track up to 10 products in your Priority Watchlist');
      return;
    }
    if (watchlist.includes(productId)) {
      alert('This product is already in your watchlist');
      return;
    }
    saveWatchlist([...watchlist, productId]);
  };

  const removeFromWatchlist = (productId) => {
    saveWatchlist(watchlist.filter(id => id !== productId));
  };

  const getStockPercentage = (current, min) => {
    return Math.round((current / (min * 2)) * 100);
  };

  const getStockStatus = (current, min) => {
    const percentage = getStockPercentage(current, min);
    if (percentage < 30) return { label: 'Low Stock', class: 'red', badge: 'badge-danger' };
    if (percentage < 60) return { label: 'Reorder Soon', class: 'yellow', badge: 'badge-warning' };
    return { label: 'Healthy', class: 'green', badge: 'badge-success' };
  };

  const calculateTotalOilVolume = () => {
    return products
      .filter(p => p.category === 'OILS')
      .reduce((total, product) => total + (product.currentStock || 0), 0);
  };

  const formatNumber = (num) => {
    return new Intl.NumberFormat('en-US').format(Math.round(num));
  };

  const countByCategory = (category) => {
    return products.filter(p => p.category === category).length;
  };

  if (loading) {
    return (
      <div className="container" style={{ paddingTop: '40px' }}>
        <div style={{ textAlign: 'center', padding: '60px', color: '#6b7280' }}>
          Loading dashboard...
        </div>
      </div>
    );
  }

  const lowStockProducts = products.filter(p => p.currentStock < p.minStockLevel);
  const oilsData = products.filter(p => p.category === 'OILS');
  const machinesData = products.filter(p => p.category === 'MACHINES_SPARES');
  const rawMaterialsData = products.filter(p => p.category === 'RAW_MATERIALS');
  const totalOilVolume = calculateTotalOilVolume();
  const watchlistProducts = products.filter(p => watchlist.includes(p.id));

  return (
    <div className="container" style={{ paddingTop: '40px' }}>
      <div className="page-header">
        <div>
          <h2 className="page-title">SCENT STOCK MANAGER DASHBOARD</h2>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button 
            className="btn btn-secondary"
            onClick={() => exportLowStockToShopifyCSV(products)}
            style={{ background: '#dc2626', color: 'white', fontSize: '13px' }}
            disabled={lowStockProducts.length === 0}
          >
            ⚠️ Export Low Stock to Shopify
          </button>
          <button 
            className="btn btn-secondary"
            onClick={() => exportToShopifyCSV(products)}
            style={{ background: '#5f3dc4', color: 'white', fontSize: '13px' }}
          >
            🛍️ Export All to Shopify
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '24px', marginBottom: '32px' }}>
        <div className="card" style={{ borderLeft: '4px solid #3b82f6' }}>
          <h3 style={{ fontSize: '14px', fontWeight: '700', color: '#64748b', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Total Products
          </h3>
          <div style={{ fontSize: '32px', fontWeight: '900', color: '#3b82f6', marginBottom: '8px' }}>
            {products.length}
          </div>
          <div style={{ fontSize: '13px', color: '#64748b' }}>
            {lowStockProducts.length} need attention
          </div>
        </div>

        <div className="card" style={{ borderLeft: '4px solid #10b981' }}>
          <h3 style={{ fontSize: '14px', fontWeight: '700', color: '#64748b', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Essential Oils
          </h3>
          <div style={{ fontSize: '32px', fontWeight: '900', color: '#10b981', marginBottom: '8px' }}>
            {countByCategory('OILS')}
          </div>
          <div style={{ fontSize: '13px', color: '#64748b' }}>
            {formatNumber(totalOilVolume)} mL total volume
          </div>
        </div>

        <div className="card" style={{ borderLeft: '4px solid #8b5cf6' }}>
          <h3 style={{ fontSize: '14px', fontWeight: '700', color: '#64748b', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Machines & Spares
          </h3>
          <div style={{ fontSize: '32px', fontWeight: '900', color: '#8b5cf6', marginBottom: '8px' }}>
            {countByCategory('MACHINES_SPARES')}
          </div>
          <div style={{ fontSize: '13px', color: '#64748b' }}>
            {machinesData.filter(p => p.currentStock < p.minStockLevel).length} low stock
          </div>
        </div>

        <div className="card" style={{ borderLeft: '4px solid #f59e0b' }}>
          <h3 style={{ fontSize: '14px', fontWeight: '700', color: '#64748b', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Raw Materials
          </h3>
          <div style={{ fontSize: '32px', fontWeight: '900', color: '#f59e0b', marginBottom: '8px' }}>
            {countByCategory('RAW_MATERIALS')}
          </div>
          <div style={{ fontSize: '13px', color: '#64748b' }}>
            {rawMaterialsData.filter(p => p.currentStock < p.minStockLevel).length} low stock
          </div>
        </div>
      </div>

      {/* Priority Watchlist */}
      <div className="card" style={{ marginBottom: '32px', borderLeft: '4px solid #3b82f6' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#3b82f6' }}>
            🤖 Priority Watchlist ({watchlistProducts.length}/10)
          </h3>
          <button 
            className="btn btn-primary"
            onClick={() => setShowWatchlistModal(true)}
            style={{ fontSize: '13px', padding: '8px 16px' }}
          >
            + Add Product
          </button>
        </div>
        
        {watchlistProducts.length > 0 ? (
          <div style={{ display: 'grid', gap: '12px' }}>
            {watchlistProducts.map(product => {
              const status = getStockStatus(product.currentStock, product.minStockLevel);
              const percentage = getStockPercentage(product.currentStock, product.minStockLevel);
              
              return (
                <div key={product.id} style={{ 
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  padding: '12px',
                  background: '#f8fafc',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0'
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <span style={{ fontWeight: '600' }}>{product.name}</span>
                      <span style={{ fontSize: '12px', color: '#64748b' }}>
                        ({product.productCode})
                      </span>
                      <span className={`badge ${status.badge}`} style={{ fontSize: '11px' }}>
                        {status.label}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: '16px', fontSize: '13px', color: '#64748b' }}>
                      <span>Current: <strong>{product.currentStock} {product.unit}</strong></span>
                      <span>Min: <strong>{product.minStockLevel} {product.unit}</strong></span>
                      <span>Supplier: <strong>{product.supplier || '-'}</strong></span>
                    </div>
                  </div>
                  <button
                    onClick={() => removeFromWatchlist(product.id)}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '18px',
                      color: '#ef4444',
                      padding: '4px 8px'
                    }}
                    title="Remove from watchlist"
                  >
                    ✕
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ 
            textAlign: 'center', 
            padding: '40px', 
            color: '#9ca3af',
            background: '#f8fafc',
            borderRadius: '8px',
            border: '2px dashed #e2e8f0'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>⭐</div>
            <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '4px' }}>
              No products in your watchlist
            </div>
            <div style={{ fontSize: '13px' }}>
              Click "+ Add Product" to track your most important products
            </div>
          </div>
        )}
      </div>

      {/* Low Stock Alerts - Increased to 10 */}
      {lowStockProducts.length > 0 && (
        <div className="card" style={{ marginBottom: '32px', borderLeft: '4px solid #ef4444' }}>
          <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '16px', color: '#ef4444' }}>
            ⚠️ Low Stock Alerts ({lowStockProducts.length})
          </h3>
          <div style={{ display: 'grid', gap: '12px' }}>
            {lowStockProducts.slice(0, 10).map(product => {
              const status = getStockStatus(product.currentStock, product.minStockLevel);
              return (
                <div key={product.id} style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  padding: '12px',
                  background: '#fef2f2',
                  borderRadius: '8px'
                }}>
                  <div>
                    <div style={{ fontWeight: '600', marginBottom: '4px' }}>{product.name}</div>
                    <div style={{ fontSize: '12px', color: '#64748b' }}>
                      {product.productCode} • {product.category === 'MACHINES_SPARES' ? 'Machines & Spares' : product.category === 'RAW_MATERIALS' ? 'Raw Materials' : 'Oils'}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: '700', color: '#ef4444' }}>
                      {product.currentStock} {product.unit}
                    </div>
                    <div style={{ fontSize: '12px', color: '#64748b' }}>
                      Min: {product.minStockLevel} {product.unit}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent Transactions */}
      <div className="card" style={{ marginTop: '32px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '16px' }}>
          Recent Transactions
        </h3>
        {data?.recentTransactions && data.recentTransactions.length > 0 ? (
          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Product</th>
                  <th>Category</th>
                  <th>Type</th>
                  <th>Quantity</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {data.recentTransactions.map(tx => (
                  <tr key={tx.id}>
                    <td style={{ fontSize: '12px', color: '#64748b' }}>
                      {new Date(tx.created_at).toLocaleDateString()}
                    </td>
                    <td style={{ fontWeight: '600' }}>{tx.product_name || '-'}</td>
                    <td>
                      <span className="badge" style={{ fontSize: '11px' }}>
                        {tx.category === 'MACHINES_SPARES' ? 'Machines & Spares' : tx.category === 'RAW_MATERIALS' ? 'Raw Materials' : 'Oils'}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${tx.type === 'add' ? 'badge-success' : 'badge-danger'}`}>
                        {tx.type === 'add' ? '+ Add' : '- Remove'}
                      </span>
                    </td>
                    <td style={{ fontWeight: '600' }}>
                      {tx.quantity} {tx.unit}
                    </td>
                    <td style={{ fontSize: '13px', color: '#64748b' }}>{tx.notes || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '40px', color: '#9ca3af' }}>
            No transactions yet
          </div>
        )}
      </div>

      {/* Add to Watchlist Modal */}
      {showWatchlistModal && (
        <div className="modal-overlay" onClick={() => setShowWatchlistModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h2>Add Product to Priority Watchlist</h2>
              <button className="modal-close" onClick={() => setShowWatchlistModal(false)}>×</button>
            </div>
            
            <div style={{ marginBottom: '16px', padding: '12px', background: '#eff6ff', borderRadius: '8px', fontSize: '13px', color: '#1e40af' }}>
              <strong>💡 Tip:</strong> Select up to 10 products you want to monitor closely (best sellers, critical items, etc.)
            </div>

            <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
              {products
                .filter(p => !watchlist.includes(p.id))
                .map(product => (
                  <div 
                    key={product.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '12px',
                      borderBottom: '1px solid #e5e7eb',
                      cursor: 'pointer'
                    }}
                    onClick={() => {
                      addToWatchlist(product.id);
                      if (watchlist.length >= 9) {
                        setShowWatchlistModal(false);
                      }
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: '600', marginBottom: '4px' }}>{product.name}</div>
                      <div style={{ fontSize: '12px', color: '#64748b' }}>
                        {product.productCode} • {product.category}
                      </div>
                    </div>
                    <button
                      className="btn btn-primary"
                      style={{ fontSize: '12px', padding: '6px 12px' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        addToWatchlist(product.id);
                        if (watchlist.length >= 9) {
                          setShowWatchlistModal(false);
                        }
                      }}
                    >
                      + Add
                    </button>
                  </div>
                ))}
            </div>

            <div className="modal-footer">
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={() => setShowWatchlistModal(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
