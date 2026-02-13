import { useState, useEffect } from 'react';
import { exportToShopifyCSV, exportLowStockToShopifyCSV } from '../utils/shopifyExport';

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
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

  const getStockPercentage = (current, min) => {
    return Math.round((current / (min * 2)) * 100);
  };

  const getStockStatus = (current, min) => {
    const percentage = getStockPercentage(current, min);
    if (percentage < 30) return { label: 'Low Stock', class: 'red', badge: 'badge-danger' };
    if (percentage < 60) return { label: 'Reorder Soon', class: 'yellow', badge: 'badge-warning' };
    return { label: 'Healthy', class: 'green', badge: 'badge-success' };
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

      {/* Main Stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value green">{data?.totalProducts || 0}</div>
          <div className="stat-label">Total Products</div>
        </div>

        <div className="stat-card">
          <div className="stat-value red">
            {lowStockProducts.length}
            {lowStockProducts.length > 0 && <span className="alert-icon">!</span>}
          </div>
          <div className="stat-label">Low Stock Alerts</div>
        </div>

        <div className="stat-card">
          <div className="stat-value green">{data?.totalStockValue?.oils || 0}L</div>
          <div className="stat-label">Total Oil Volume</div>
        </div>
      </div>

      {/* Category Breakdown */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginBottom: '32px' }}>
        <div className="card" style={{ borderLeft: '4px solid #3b82f6' }}>
          <h3 style={{ fontSize: '14px', fontWeight: '700', color: '#64748b', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Essential Oils
          </h3>
          <div style={{ fontSize: '32px', fontWeight: '900', color: '#3b82f6', marginBottom: '8px' }}>
            {data?.byCategory?.OILS || 0}
          </div>
          <div style={{ fontSize: '13px', color: '#64748b' }}>
            {oilsData.filter(p => p.currentStock < p.minStockLevel).length} low stock
          </div>
        </div>

        <div className="card" style={{ borderLeft: '4px solid #8b5cf6' }}>
          <h3 style={{ fontSize: '14px', fontWeight: '700', color: '#64748b', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Machines & Spares
          </h3>
          <div style={{ fontSize: '32px', fontWeight: '900', color: '#8b5cf6', marginBottom: '8px' }}>
            {data?.byCategory?.MACHINES_SPARES || 0}
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
            {data?.byCategory?.RAW_MATERIALS || 0}
          </div>
          <div style={{ fontSize: '13px', color: '#64748b' }}>
            {rawMaterialsData.filter(p => p.currentStock < p.minStockLevel).length} low stock
          </div>
        </div>
      </div>

      {/* Low Stock Alerts */}
      {lowStockProducts.length > 0 && (
        <div className="card" style={{ marginBottom: '32px', borderLeft: '4px solid #ef4444' }}>
          <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '16px', color: '#ef4444' }}>
            ⚠️ Low Stock Alerts ({lowStockProducts.length})
          </h3>
          <div style={{ display: 'grid', gap: '12px' }}>
            {lowStockProducts.slice(0, 5).map(product => {
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

      {/* Stock Status by Category */}
      <div className="card">
        <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '20px' }}>
          Stock Status Overview
        </h3>
        
        {['OILS', 'MACHINES_SPARES', 'RAW_MATERIALS'].map(category => {
          const categoryProducts = products.filter(p => p.category === category);
          const categoryName = category === 'OILS' ? 'Essential Oils' : 
                              category === 'MACHINES_SPARES' ? 'Machines & Spares' : 'Raw Materials';
          
          if (categoryProducts.length === 0) return null;
          
          return (
            <div key={category} style={{ marginBottom: '32px' }}>
              <h4 style={{ fontSize: '14px', fontWeight: '700', color: '#64748b', marginBottom: '16px', textTransform: 'uppercase' }}>
                {categoryName}
              </h4>
              <div style={{ display: 'grid', gap: '16px' }}>
                {categoryProducts.slice(0, 10).map(product => {
                  const status = getStockStatus(product.currentStock, product.minStockLevel);
                  const percentage = getStockPercentage(product.currentStock, product.minStockLevel);
                  
                  return (
                    <div key={product.id}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <div>
                          <span style={{ fontWeight: '600' }}>{product.name}</span>
                          <span style={{ fontSize: '12px', color: '#64748b', marginLeft: '8px' }}>
                            ({product.productCode})
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <span className={`badge ${status.badge}`}>{status.label}</span>
                          <span style={{ fontWeight: '600' }}>
                            {product.currentStock} / {product.minStockLevel * 2} {product.unit}
                          </span>
                        </div>
                      </div>
                      <div className="progress-bar">
                        <div 
                          className={`progress-fill ${status.class}`}
                          style={{ width: `${Math.min(percentage, 100)}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

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
                      {new Date(tx.createdAt).toLocaleDateString()}
                    </td>
                    <td style={{ fontWeight: '600' }}>{tx.productName}</td>
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
    </div>
  );
}
