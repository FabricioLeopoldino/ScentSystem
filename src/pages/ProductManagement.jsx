import { useState, useEffect } from 'react';
import { exportProductsToExcel } from '../utils/excelExport';
import { exportToShopifyCSV } from '../utils/shopifyExport';

export default function ProductManagement({ user }) {
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [showIncomingModal, setShowIncomingModal] = useState(false);
  const [incomingProduct, setIncomingProduct] = useState(null);
  const [incomingFormData, setIncomingFormData] = useState({
    orderNumber: '',
    quantity: '',
    notes: ''
  });
  
  const [formData, setFormData] = useState({
    name: '',
    category: 'OILS',
    productCode: '',
    tag: '',
    unit: 'mL',
    currentStock: 0,
    minStockLevel: 0,
    supplier: '',
    supplier_code: '',
    unitPerBox: 1,
    shopifySkus: {}
  });

  useEffect(() => {
    fetchProducts();
  }, []);

  useEffect(() => {
    filterProducts();
  }, [products, categoryFilter, searchTerm]);

  const fetchProducts = async () => {
    try {
      const res = await fetch('/api/products');
      const data = await res.json();
      setProducts(data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching products:', error);
      setLoading(false);
    }
  };

  const filterProducts = () => {
    let filtered = products;
    
    if (categoryFilter !== 'ALL') {
      filtered = filtered.filter(p => p.category === categoryFilter);
    }
    
    if (searchTerm) {
      filtered = filtered.filter(p => 
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.productCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.tag.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    setFilteredProducts(filtered);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      const url = editingProduct 
        ? `/api/products/${editingProduct.id}`
        : '/api/products';
      
      const method = editingProduct ? 'PUT' : 'POST';
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      
      if (res.ok) {
        alert(editingProduct ? 'Product updated!' : 'Product created!');
        setShowAddModal(false);
        setEditingProduct(null);
        resetForm();
        fetchProducts();
      }
    } catch (error) {
      alert('Error saving product: ' + error.message);
    }
  };

  const handleDelete = async (productId) => {
    if (!confirm('Are you sure you want to delete this product?')) return;
    
    try {
      const res = await fetch(`/api/products/${productId}`, {
        method: 'DELETE'
      });
      
      if (res.ok) {
        alert('Product deleted!');
        fetchProducts();
      }
    } catch (error) {
      alert('Error deleting product: ' + error.message);
    }
  };

  const handleClearIncoming = async (productId, index) => {
    if (!confirm('Clear this incoming order?')) return;
    
    try {
      const res = await fetch(`/api/products/${productId}/incoming/${index}`, {
        method: 'DELETE'
      });
      
      if (res.ok) {
        alert('Incoming order cleared!');
        fetchProducts();
      }
    } catch (error) {
      alert('Error clearing incoming order: ' + error.message);
    }
  };

  const handleOpenIncomingModal = (product) => {
    setIncomingProduct(product);
    setIncomingFormData({
      orderNumber: '',
      quantity: '',
      notes: ''
    });
    setShowIncomingModal(true);
  };

  const handleAddIncoming = async (e) => {
    e.preventDefault();
    
    if (!incomingFormData.orderNumber || !incomingFormData.quantity) {
      alert('Please fill in PO Number and Quantity');
      return;
    }
    
    try {
      const res = await fetch(`/api/products/${incomingProduct.id}/incoming`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderNumber: incomingFormData.orderNumber,
          quantity: parseFloat(incomingFormData.quantity),
          supplier: incomingProduct.supplier,
          notes: incomingFormData.notes,
          addedBy: user?.username || 'admin'
        })
      });
      
      if (res.ok) {
        alert('Incoming order added successfully!');
        setShowIncomingModal(false);
        setIncomingProduct(null);
        setIncomingFormData({ orderNumber: '', quantity: '', notes: '' });
        fetchProducts();
      } else {
        const error = await res.json();
        alert(error.error || 'Error adding incoming order');
      }
    } catch (error) {
      alert('Error adding incoming order: ' + error.message);
    }
  };

  const handleEdit = (product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      category: product.category,
      productCode: product.productCode,
      tag: product.tag,
      unit: product.unit,
      currentStock: product.currentStock,
      minStockLevel: product.minStockLevel,
      supplier: product.supplier || '',
      supplier_code: product.supplier_code || '',
      unitPerBox: product.unitPerBox || 1,
      shopifySkus: product.shopifySkus || {}
    });
    setShowAddModal(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      category: 'OILS',
      productCode: '',
      tag: '',
      unit: 'mL',
      currentStock: 0,
      minStockLevel: 0,
      supplier: '',
      supplier_code: '',
      unitPerBox: 1,
      shopifySkus: {}
    });
  };

  const getCategoryBadge = (category) => {
    const colors = {
      OILS: 'bg-blue-100 text-blue-800',
      MACHINES_SPARES: 'bg-purple-100 text-purple-800',
      RAW_MATERIALS: 'bg-orange-100 text-orange-800'
    };
    return colors[category] || 'bg-gray-100 text-gray-800';
  };

  const getCategoryLabel = (category) => {
    const labels = {
      OILS: 'Oils',
      MACHINES_SPARES: 'Machines & Spares',
      RAW_MATERIALS: 'Raw Materials'
    };
    return labels[category] || category;
  };

  const getStockStatus = (product) => {
    if (product.currentStock === 0) return { label: 'Out of Stock', color: 'text-red-600' };
    if (product.currentStock < product.minStockLevel) return { label: 'Low Stock', color: 'text-orange-600' };
    return { label: 'Healthy', color: 'text-green-600' };
  };

  if (loading) {
    return <div className="loading">Loading products...</div>;
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Product Management</h1>
          <p>Manage all products across categories</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button 
            className="btn btn-secondary"
            onClick={() => exportToShopifyCSV(products)}
            style={{ background: '#5f3dc4', color: 'white' }}
          >
            🛍️ Export for Shopify
          </button>
          <button 
            className="btn btn-secondary"
            onClick={() => exportProductsToExcel(products)}
          >
            📊 Export to Excel
          </button>
          {user.role === 'admin' && (
            <button 
              className="btn btn-primary"
              onClick={() => {
                resetForm();
                setEditingProduct(null);
                setShowAddModal(true);
              }}
            >
              + Add Product
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ flex: '1', minWidth: '200px' }}>
            <input
              type="text"
              className="input"
              placeholder="Search by name, code, or tag..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
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

      {/* Products Table */}
      <div className="card">
        <div style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Tag</th>
                <th>Product Code</th>
                <th>Name</th>
                <th>Category</th>
                <th>Stock</th>
                <th>Min Level</th>
                <th>Status</th>
                <th>Incoming Orders</th>
                <th>Supplier</th>
                {user.role === 'admin' && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map(product => {
                const status = getStockStatus(product);
                return (
                  <tr key={product.id}>
                    <td style={{ fontFamily: 'monospace', fontSize: '12px' }}>{product.tag}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: '12px' }}>{product.productCode}</td>
                    <td style={{ fontWeight: '600' }}>{product.name}</td>
                    <td>
                      <span className={`badge ${getCategoryBadge(product.category)}`}>
                        {getCategoryLabel(product.category)}
                      </span>
                    </td>
                    <td>
                      {product.currentStock} {product.unit}
                      {product.unitPerBox > 1 && (
                        <span style={{ fontSize: '11px', color: '#64748b', marginLeft: '4px' }}>
                          ({product.stockBoxes} boxes)
                        </span>
                      )}
                    </td>
                    <td>{product.minStockLevel} {product.unit}</td>
                    <td className={status.color} style={{ fontWeight: '600' }}>{status.label}</td>
                    <td>
                      {product.incomingOrders && product.incomingOrders.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          {product.incomingOrders.map((order, idx) => (
                            <div key={idx} style={{ 
                              display: 'flex', 
                              alignItems: 'center', 
                              gap: '8px',
                              padding: '4px 8px',
                              background: '#fef3c7',
                              borderRadius: '4px',
                              fontSize: '12px'
                            }}>
                              <span style={{ fontWeight: '600', color: '#92400e' }}>
                                {order.orderNumber}
                              </span>
                              <span style={{ color: '#78350f' }}>
                                ({order.quantity} {product.unit})
                              </span>
                              {user.role === 'admin' && (
                                <button
                                  onClick={() => handleClearIncoming(product.id, idx)}
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    fontSize: '16px',
                                    marginLeft: 'auto'
                                  }}
                                  title="Clear incoming order"
                                >
                                  ✕
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span style={{ color: '#9ca3af', fontSize: '12px' }}>-</span>
                      )}
                    </td>
                    <td style={{ fontSize: '13px', color: '#64748b' }}>
                      {product.supplier || '-'}
                    </td>
                    {user.role === 'admin' && (
                      <td>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          <button 
                            className="btn btn-secondary"
                            onClick={() => handleEdit(product)}
                            style={{ fontSize: '12px', padding: '6px 12px' }}
                          >
                            Edit
                          </button>
                          <button 
                            className="btn"
                            onClick={() => handleOpenIncomingModal(product)}
                            style={{ 
                              fontSize: '12px', 
                              padding: '6px 12px',
                              background: '#f59e0b',
                              color: 'white',
                              border: 'none'
                            }}
                            title="Add Incoming Order / Purchase Order"
                          >
                            + Incoming
                          </button>
                          <button 
                            className="btn btn-danger"
                            onClick={() => handleDelete(product.id)}
                            style={{ fontSize: '12px', padding: '6px 12px' }}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    )}
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

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingProduct ? 'Edit Product' : 'Add New Product'}</h2>
              <button className="modal-close" onClick={() => setShowAddModal(false)}>X</button>
            </div>
            
            <form onSubmit={handleSubmit}>
              <div className="form-grid">
                <div className="form-group">
                  <label>Product Name *</label>
                  <input
                    type="text"
                    className="input"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Category *</label>
                  <select
                    className="input"
                    value={formData.category}
                    onChange={(e) => {
                      const category = e.target.value;
                      setFormData({
                        ...formData, 
                        category,
                        unit: category === 'OILS' ? 'mL' : 'units'
                      });
                    }}
                    required
                  >
                    <option value="OILS">Essential Oils</option>
                    <option value="MACHINES_SPARES">Machines & Spares</option>
                    <option value="RAW_MATERIALS">Raw Materials</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Product Code</label>
                  <input
                    type="text"
                    className="input"
                    value={formData.productCode}
                    onChange={(e) => setFormData({...formData, productCode: e.target.value})}
                    placeholder="Auto-generated if empty"
                  />
                </div>

                <div className="form-group">
                  <label>Tag</label>
                  <input
                    type="text"
                    className="input"
                    value={formData.tag}
                    onChange={(e) => setFormData({...formData, tag: e.target.value})}
                    placeholder="Auto-generated if empty"
                  />
                </div>

                <div className="form-group">
                  <label>Current Stock *</label>
                  <input
                    type="number"
                    className="input"
                    value={formData.currentStock}
                    onChange={(e) => setFormData({...formData, currentStock: parseInt(e.target.value) || 0})}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Min Stock Level *</label>
                  <input
                    type="number"
                    className="input"
                    value={formData.minStockLevel}
                    onChange={(e) => setFormData({...formData, minStockLevel: parseInt(e.target.value) || 0})}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Unit</label>
                  <select
                    className="input"
                    value={formData.unit}
                    onChange={(e) => setFormData({...formData, unit: e.target.value})}
                  >
                    <option value="mL">mL (milliliters)</option>
                    <option value="units">Units</option>
                    <option value="kg">kg (kilograms)</option>
                  </select>
                </div>

                {formData.category !== 'OILS' && (
                  <div className="form-group">
                    <label>Units Per Box</label>
                    <input
                      type="number"
                      className="input"
                      value={formData.unitPerBox}
                      onChange={(e) => setFormData({...formData, unitPerBox: parseInt(e.target.value) || 1})}
                    />
                  </div>
                )}

                <div className="form-group">
                  <label>Supplier</label>
                  <input
                    type="text"
                    className="input"
                    value={formData.supplier}
                    onChange={(e) => setFormData({...formData, supplier: e.target.value})}
                  />
                </div>

                <div className="form-group">
                  <label>Supplier Code</label>
                  <input
                    type="text"
                    className="input"
                    value={formData.supplier_code}
                    onChange={(e) => setFormData({...formData, supplier_code: e.target.value})}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingProduct ? 'Update Product' : 'Create Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Incoming Order Modal */}
      {showIncomingModal && incomingProduct && (
        <div className="modal-overlay" onClick={() => setShowIncomingModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Add Incoming Order - Purchase Order</h2>
              <button className="modal-close" onClick={() => setShowIncomingModal(false)}>×</button>
            </div>
            
            <form onSubmit={handleAddIncoming}>
              <div style={{ marginBottom: '20px', padding: '12px', background: '#f1f5f9', borderRadius: '8px' }}>
                <div style={{ fontWeight: '600', marginBottom: '4px' }}>Product:</div>
                <div style={{ fontSize: '14px', color: '#64748b' }}>{incomingProduct.name}</div>
                <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
                  Tag: {incomingProduct.tag} | Code: {incomingProduct.productCode}
                </div>
                {incomingProduct.supplier && (
                  <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
                    Supplier: {incomingProduct.supplier}
                  </div>
                )}
              </div>

              <div className="form-group">
                <label>PO Number / Order Number *</label>
                <input
                  type="text"
                  className="input"
                  value={incomingFormData.orderNumber}
                  onChange={(e) => setIncomingFormData({...incomingFormData, orderNumber: e.target.value})}
                  placeholder="e.g., #PO166"
                  required
                />
                <small style={{ fontSize: '12px', color: '#64748b', marginTop: '4px', display: 'block' }}>
                  Same PO number as in Shopify Purchase Order
                </small>
              </div>

              <div className="form-group">
                <label>Quantity *</label>
                <input
                  type="number"
                  className="input"
                  value={incomingFormData.quantity}
                  onChange={(e) => setIncomingFormData({...incomingFormData, quantity: e.target.value})}
                  placeholder="e.g., 300"
                  min="0"
                  step="any"
                  required
                />
                <small style={{ fontSize: '12px', color: '#64748b', marginTop: '4px', display: 'block' }}>
                  Units: {incomingProduct.unit}
                </small>
              </div>

              <div className="form-group">
                <label>Notes (Optional)</label>
                <textarea
                  className="input"
                  value={incomingFormData.notes}
                  onChange={(e) => setIncomingFormData({...incomingFormData, notes: e.target.value})}
                  placeholder="e.g., Expected arrival 25/02, Wilmar BioEthanol"
                  rows="3"
                />
              </div>

              <div style={{ 
                padding: '12px', 
                background: '#fef3c7', 
                borderRadius: '8px',
                marginBottom: '20px',
                fontSize: '13px',
                color: '#78350f'
              }}>
                <strong>💡 Reminder:</strong> After creating the PO in Shopify, add it here to track incoming stock. 
                When you receive the goods and click "Receive inventory" in Shopify, update the stock in ScentSystem via Stock Management.
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowIncomingModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Add Incoming Order
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
