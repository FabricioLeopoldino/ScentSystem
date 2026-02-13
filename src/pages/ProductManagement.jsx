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
  
  const [formData, setFormData] = useState({
    name: '',
    category: 'OILS',
    productCode: '',
    tag: '',
    unit: 'mL',
    currentStock: 0,
    minStockLevel: 0,
    supplier: '',
    supplierCode: '',
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
      supplierCode: product.supplierCode || '',
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
      supplierCode: '',
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
                    <td style={{ fontSize: '13px', color: '#64748b' }}>
                      {product.supplier || '-'}
                    </td>
                    {user.role === 'admin' && (
                      <td>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button 
                            className="btn btn-secondary"
                            onClick={() => handleEdit(product)}
                            style={{ fontSize: '12px', padding: '6px 12px' }}
                          >
                            Edit
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
              <button className="modal-close" onClick={() => setShowAddModal(false)}>×</button>
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
                    value={formData.supplierCode}
                    onChange={(e) => setFormData({...formData, supplierCode: e.target.value})}
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
    </div>
  );
}
