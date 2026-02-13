import { useState, useEffect } from 'react';

export default function StockManagement() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [type, setType] = useState('add');
  const [quantity, setQuantity] = useState('');
  const [notes, setNotes] = useState('');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');

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
          notes
        })
      });

      if (res.ok) {
        await fetchProducts();
        setShowModal(false);
        setQuantity('');
        setNotes('');
        alert('Stock adjusted successfully!');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Error adjusting stock');
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
                <th>Current Stock</th>
                <th>Min Level</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map(product => {
                const status = getStockStatus(product);
                return (
                  <tr key={product.id}>
                    <td style={{ fontFamily: 'monospace', fontSize: '12px' }}>
                      {product.productCode}
                    </td>
                    <td style={{ fontWeight: '600' }}>{product.name}</td>
                    <td>
                      <span className="badge" style={{ fontSize: '11px' }}>
                        {getCategoryLabel(product.category)}
                      </span>
                    </td>
                    <td style={{ fontWeight: '700', fontSize: '15px' }}>
                      {product.currentStock} {product.unit}
                      {product.unitPerBox > 1 && (
                        <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '400' }}>
                          ({product.stockBoxes} boxes)
                        </div>
                      )}
                    </td>
                    <td>{product.minStockLevel} {product.unit}</td>
                    <td>
                      <span className={`badge badge-${status.class === 'green' ? 'success' : status.class === 'yellow' ? 'warning' : 'danger'}`}>
                        {status.label}
                      </span>
                    </td>
                    <td>
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
    </div>
  );
}
