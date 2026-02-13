import { useState, useEffect } from 'react';

export default function RawMaterials({ user }) {
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [adjustingProduct, setAdjustingProduct] = useState(null);
  const [adjustQuantity, setAdjustQuantity] = useState('');
  const [adjustNote, setAdjustNote] = useState('');
  const [adjustType, setAdjustType] = useState('add');

  useEffect(() => {
    fetchProducts();
  }, []);

  useEffect(() => {
    const filtered = products.filter(p =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.productCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.tag.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredProducts(filtered);
  }, [searchTerm, products]);

  const fetchProducts = async () => {
    try {
      const res = await fetch('/api/products');
      const data = await res.json();
      const rawMaterials = data.filter(p => p.category === 'RAW_MATERIALS');
      setProducts(rawMaterials);
      setFilteredProducts(rawMaterials);
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  };

  const handleAdjustStock = async () => {
    if (!adjustQuantity || adjustQuantity <= 0) {
      alert('Please enter a valid quantity');
      return;
    }

    try {
      const res = await fetch('/api/stock/adjust', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: adjustingProduct.id,
          quantity: parseInt(adjustQuantity),
          type: adjustType,
          note: adjustNote || `Manual ${adjustType === 'add' ? 'addition' : 'removal'} of raw material`
        })
      });

      if (res.ok) {
        alert('Stock adjusted successfully!');
        setAdjustingProduct(null);
        setAdjustQuantity('');
        setAdjustNote('');
        fetchProducts();
      } else {
        alert('Failed to adjust stock');
      }
    } catch (error) {
      console.error('Error adjusting stock:', error);
      alert('Error adjusting stock');
    }
  };

  const getStatusColor = (product) => {
    if (product.currentStock <= product.minStockLevel) return '#ef4444';
    if (product.currentStock <= product.minStockLevel * 1.5) return '#f59e0b';
    return '#10b981';
  };

  const getStatusText = (product) => {
    if (product.currentStock <= product.minStockLevel) return 'Low Stock';
    if (product.currentStock <= product.minStockLevel * 1.5) return 'Reorder Soon';
    return 'Healthy';
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1>Raw Materials & Components</h1>
        <p>Manage packaging materials, batteries, and spare parts</p>
      </div>

      <div className="filters">
        <input
          type="text"
          placeholder="Search by name, code, or tag..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="search-input"
        />
      </div>

      <div className="stats-grid" style={{ marginBottom: '2rem' }}>
        <div className="stat-card" style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
          <div className="stat-value">{products.length}</div>
          <div className="stat-label">Total Components</div>
        </div>
        <div className="stat-card" style={{ background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' }}>
          <div className="stat-value">{products.filter(p => p.currentStock <= p.minStockLevel).length}</div>
          <div className="stat-label">Low Stock Items</div>
        </div>
        <div className="stat-card" style={{ background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)' }}>
          <div className="stat-value">{products.reduce((sum, p) => sum + (p.stockBoxes || 0), 0)}</div>
          <div className="stat-label">Total Boxes</div>
        </div>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>TAG</th>
              <th>Product Code</th>
              <th>Name</th>
              <th>Stock (Units)</th>
              <th>Stock (Boxes)</th>
              <th>Units/Box</th>
              <th>Min Level</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredProducts.map(product => (
              <tr key={product.id}>
                <td>{product.tag}</td>
                <td><strong>{product.productCode}</strong></td>
                <td>{product.name}</td>
                <td>{product.currentStock} units</td>
                <td>{product.stockBoxes || 0} boxes</td>
                <td>{product.unitPerBox || 1}</td>
                <td>{product.minStockLevel} units</td>
                <td>
                  <span className="status-badge" style={{ background: getStatusColor(product) }}>
                    {getStatusText(product)}
                  </span>
                </td>
                <td>
                  <button
                    className="btn btn-primary"
                    onClick={() => setAdjustingProduct(product)}
                  >
                    Adjust Stock
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {adjustingProduct && (
        <div className="modal-overlay" onClick={() => setAdjustingProduct(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Adjust Stock</h2>
            <p><strong>{adjustingProduct.name}</strong></p>
            <p>Current Stock: {adjustingProduct.currentStock} units ({adjustingProduct.stockBoxes || 0} boxes)</p>

            <div className="form-group">
              <label>Type</label>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <button
                  className={`btn ${adjustType === 'add' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setAdjustType('add')}
                >
                  ➕ Add Stock
                </button>
                <button
                  className={`btn ${adjustType === 'remove' ? 'btn-danger' : 'btn-secondary'}`}
                  onClick={() => setAdjustType('remove')}
                >
                  ➖ Remove Stock
                </button>
              </div>
            </div>

            <div className="form-group">
              <label>Quantity (units) *</label>
              <input
                type="number"
                value={adjustQuantity}
                onChange={(e) => setAdjustQuantity(e.target.value)}
                placeholder="Enter quantity in units"
                min="1"
              />
            </div>

            <div className="form-group">
              <label>Note (optional)</label>
              <textarea
                value={adjustNote}
                onChange={(e) => setAdjustNote(e.target.value)}
                placeholder="Add notes about this adjustment..."
                rows="3"
              />
            </div>

            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setAdjustingProduct(null)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleAdjustStock}>
                Confirm Adjustment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
