import { useState, useEffect } from 'react';
import BinLocationInput from '../components/BinLocationInput';

export default function StockManagement({ user }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [type, setType] = useState('add');
  const [quantity, setQuantity] = useState('');
  const [notes, setNotes] = useState('');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [locationProduct, setLocationProduct] = useState(null);
  const [newLocation, setNewLocation] = useState('');

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const res = await fetch('/api/products');
      const data = await res.json();
      setProducts(data);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAdjust = async (e) => {
    e.preventDefault();
    
    try {
      const res = await fetch('/api/stock/adjust', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: selectedProduct.id,
          quantity: parseInt(quantity),
          type,
          note: notes
        })
      });

      if (res.ok) {
        await fetchProducts();
        setShowModal(false);
        setQuantity('');
        setNotes('');
        alert('Stock adjusted successfully!');
      } else {
        const error = await res.json();
        alert(error.error || 'Failed to adjust stock');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Error adjusting stock');
    }
  };

  const handleUpdateLocation = async (e) => {
    e.preventDefault();
    
    if (!newLocation.trim()) {
      alert('Please enter a location');
      return;
    }
    
    try {
      const res = await fetch(`/api/products/${locationProduct.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...locationProduct,
          bin_location: newLocation
        })
      });
      
      if (res.ok) {
        alert('Location updated successfully!');
        setShowLocationModal(false);
        setLocationProduct(null);
        setNewLocation('');
        fetchProducts();
      } else {
        const error = await res.json();
        alert(`Error: ${error.error || 'Failed to update location'}`);
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Error updating location: ' + error.message);
    }
  };

  const getCategoryLabel = (category) => {
    const labels = {
      OILS: 'Oils',
      MACHINES_SPARES: 'Machines & Spares',
      RAW_MATERIALS: 'Raw Materials'
    };
    return labels[category] || category;
  };

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(search.toLowerCase()) ||
                         product.productCode.toLowerCase().includes(search.toLowerCase()) ||
                         product.tag.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = categoryFilter === 'ALL' || product.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const getStockStatus = (product) => {
    if (product.currentStock === 0) return { label: 'Out of Stock', class: 'red' };
    if (product.currentStock < product.minStockLevel) return { label: 'Low Stock', class: 'yellow' };
    return { label: 'Healthy', class: 'green' };
  };

  if (loading) {
    return (
      <div className="container" style={{ paddingTop: '40px' }}>
        <div style={{ textAlign: 'center', padding: '60px', color: '#6b7280' }}>
          Loading stock...
        </div>
      </div>
    );
  }

  return (
    <div className="container" style={{ paddingTop: '40px' }}>
      <div className="page-header">
        <h2 className="page-title">STOCK MANAGEMENT</h2>
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ flex: '1', minWidth: '200px' }}>
            <input
              type="text"
              className="input"
              placeholder="Search products..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          
          <div style={{ display: 'flex', gap: '8px' }}>
            {[
              { value: 'ALL', label: 'All' },
              { value: 'OILS', label: 'Oils' },
              { value: 'MACHINES_SPARES', label: 'Machines & Spares' },
              { value: 'RAW_MATERIALS', label: 'Raw Materials' }
            ].map(cat => (
              <button
                key={cat.value}
                className={`btn ${categoryFilter === cat.value ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setCategoryFilter(cat.value)}
                style={{ fontSize: '13px', padding: '8px 16px' }}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Stock Table */}
      <div className="card">
        <div style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Product Code</th>
                <th>Name</th>
                <th>Category</th>
                <th>Bin Location</th>
                <th>Current Stock</th>
                <th>Min Level</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map(product => {
                const status = getStockStatus(product);
                const isNegative = product.currentStock < 0;
                return (
                  <tr 
                    key={product.id}
                    style={isNegative ? {
                      background: '#fef2f2',
                      borderLeft: '4px solid #dc2626'
                    } : {}}
                  >
                    <td style={{ fontFamily: 'monospace', fontSize: '12px' }}>
                      {product.productCode}
                    </td>
                    <td style={{ fontWeight: '600' }}>
                      {product.name}
                      {isNegative && (
                        <span style={{
                          marginLeft: '8px',
                          padding: '2px 8px',
                          background: '#dc2626',
                          color: 'white',
                          fontSize: '11px',
                          fontWeight: '700',
                          borderRadius: '4px'
                        }}>
                          🚨 NEGATIVE
                        </span>
                      )}
                    </td>
                    <td>
                      <span className="badge" style={{ fontSize: '11px' }}>
                        {getCategoryLabel(product.category)}
                      </span>
                    </td>
                    <td style={{ fontSize: '12px', color: '#64748b' }}>
                      {product.bin_location || '-'}
                    </td>
                    <td style={{ 
                      fontWeight: '700', 
                      fontSize: '15px',
                      color: isNegative ? '#dc2626' : 'inherit'
                    }}>
                      {product.currentStock} {product.unit}
                      {product.unitPerBox > 1 && (
                        <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '400' }}>
                          ({product.stockBoxes} boxes)
                        </div>
                      )}
                      {isNegative && (
                        <div style={{
                          fontSize: '11px',
                          color: '#991b1b',
                          fontWeight: '600',
                          marginTop: '4px'
                        }}>
                          ⚠️ CHECK PHYSICAL COUNT
                        </div>
                      )}
                    </td>
                    <td>{product.minStockLevel} {product.unit}</td>
                    <td>
                      {isNegative ? (
                        <span className="badge" style={{ 
                          background: '#dc2626', 
                          color: 'white',
                          fontWeight: '700'
                        }}>
                          NEGATIVE STOCK
                        </span>
                      ) : (
                        <span className={`badge badge-${status.class === 'green' ? 'success' : status.class === 'yellow' ? 'warning' : 'danger'}`}>
                          {status.label}
                        </span>
                      )}
                    </td>
                    <td>
                      {user?.role === 'admin' ? (
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            className="btn btn-primary"
                            onClick={() => {
                              setSelectedProduct(product);
                              setShowModal(true);
                              setType('add');
                              setQuantity('');
                              setNotes('');
                            }}
                            style={{ fontSize: '12px', padding: '6px 16px' }}
                          >
                            Adjust Stock
                          </button>
                          <button
                            className="btn btn-secondary"
                            onClick={() => {
                              setLocationProduct(product);
                              setNewLocation(product.bin_location || '');
                              setShowLocationModal(true);
                            }}
                            style={{ fontSize: '12px', padding: '6px 16px' }}
                          >
                            📍 Edit Location
                          </button>
                        </div>
                      ) : (
                        <button
                          className="btn btn-secondary"
                          disabled
                          title="Admin only"
                          style={{ fontSize: '12px', padding: '6px 16px', cursor: 'not-allowed', opacity: 0.5 }}
                        >
                          🔒 Admin Only
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        
        <div style={{ marginTop: '16px', fontSize: '14px', color: '#64748b' }}>
          Showing {filteredProducts.length} of {products.length} products
        </div>
      </div>

      {/* Adjust Stock Modal */}
      {showModal && selectedProduct && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Adjust Stock: {selectedProduct.name}</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
            </div>
            
            <form onSubmit={handleAdjust}>
              <div className="card" style={{ marginBottom: '20px', background: '#f8fafc' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>Product Code</div>
                    <div style={{ fontFamily: 'monospace', fontWeight: '600' }}>{selectedProduct.productCode}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>Category</div>
                    <div style={{ fontWeight: '600' }}>{getCategoryLabel(selectedProduct.category)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>Current Stock</div>
                    <div style={{ fontWeight: '700', fontSize: '18px', color: '#2563eb' }}>
                      {selectedProduct.currentStock} {selectedProduct.unit}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>Min Level</div>
                    <div style={{ fontWeight: '600' }}>{selectedProduct.minStockLevel} {selectedProduct.unit}</div>
                  </div>
                </div>
              </div>

              <div className="form-group">
                <label>Type</label>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button
                    type="button"
                    className={`btn ${type === 'add' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setType('add')}
                    style={{ flex: 1 }}
                  >
                    ➕ Add Stock
                  </button>
                  <button
                    type="button"
                    className={`btn ${type === 'remove' ? 'btn-danger' : 'btn-secondary'}`}
                    onClick={() => setType('remove')}
                    style={{ flex: 1 }}
                  >
                    ➖ Remove Stock
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label>Quantity ({selectedProduct.unit})</label>
                <input
                  type="number"
                  className="input"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder={`Enter quantity in ${selectedProduct.unit}`}
                  required
                  min="1"
                />
              </div>

              <div className="form-group">
                <label>Notes (optional)</label>
                <textarea
                  className="input"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add notes about this adjustment..."
                  rows="3"
                />
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Confirm Adjustment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Location Modal */}
      {showLocationModal && locationProduct && (
        <div className="modal-overlay" onClick={() => setShowLocationModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h2>📍 Edit Bin Location</h2>
              <button onClick={() => setShowLocationModal(false)}>&times;</button>
            </div>
            
            <form onSubmit={handleUpdateLocation}>
              <div style={{ marginBottom: '16px' }}>
                <strong>Product:</strong> {locationProduct.name}
              </div>
              
              <div style={{ marginBottom: '16px', padding: '12px', background: '#f3f4f6', borderRadius: '8px' }}>
                <strong>Current Location:</strong> {locationProduct.bin_location || 'Not set'}
              </div>
              
              <BinLocationInput
                category={locationProduct.category}
                value={newLocation}
                onChange={setNewLocation}
              />
              
              <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowLocationModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Update Location
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
