import { useState, useEffect } from 'react';
import { exportProductsToExcel } from '../utils/excelExport';
import { exportToShopifyCSV } from '../utils/shopifyExport';
import BinLocationInput from '../components/BinLocationInput';

export default function ProductManagement({ user }) {
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  
  // Incoming Orders states
  const [showIncomingModal, setShowIncomingModal] = useState(false);
  const [incomingProduct, setIncomingProduct] = useState(null);
  const [incomingFormData, setIncomingFormData] = useState({
    orderNumber: '',
    quantity: '',
    notes: ''
  });
  
  // Receive Orders states
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [receivingOrder, setReceivingOrder] = useState(null);
  const [receivingIndex, setReceivingIndex] = useState(null);
  const [receivingOption, setReceivingOption] = useState('full');
  const [receiveFormData, setReceiveFormData] = useState({
    quantityReceived: '',
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
    shopifySkus: {},
    bin_location: ''
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

  const handleOpenReceiveModal = (product, order, index) => {
    setIncomingProduct(product);
    setReceivingOrder(order);
    setReceivingIndex(index);
    setReceivingOption('full');
    setReceiveFormData({
      quantityReceived: order.quantity.toString(),
      notes: ''
    });
    setShowReceiveModal(true);
  };

  const handleReceiveIncoming = async (e) => {
    e.preventDefault();
    
    const quantityToReceive = receivingOption === 'full' 
      ? receivingOrder.quantity 
      : parseFloat(receiveFormData.quantityReceived);
    
    if (!quantityToReceive || quantityToReceive <= 0) {
      alert('Please enter a valid quantity');
      return;
    }
    
    try {
      const res = await fetch(`/api/products/${incomingProduct.id}/incoming/${receivingIndex}/receive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quantityReceived: quantityToReceive,
          notes: receiveFormData.notes || (receivingOption === 'full' 
            ? 'Full quantity received' 
            : `Partial quantity received: ${quantityToReceive} of ${receivingOrder.quantity}`),
          receivedBy: user?.username || 'admin'
        })
      });
      
      if (res.ok) {
        const data = await res.json();
        alert(`Stock updated successfully! New stock: ${data.newStock} ${incomingProduct.unit}`);
        setShowReceiveModal(false);
        setIncomingProduct(null);
        setReceivingOrder(null);
        setReceivingIndex(null);
        setReceivingOption('full');
        setReceiveFormData({ quantityReceived: '', notes: '' });
        fetchProducts();
      } else {
        const error = await res.json();
        alert(error.error || 'Error receiving incoming order');
      }
    } catch (error) {
      alert('Error receiving incoming order: ' + error.message);
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
      shopifySkus: product.shopifySkus || {},
      bin_location: product.bin_location || ''
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
      shopifySkus: {},
      bin_location: ''
    });
  };

  const getCategoryLabel = (category) => {
    const labels = {
      'OILS': 'Oils',
      'MACHINES_SPARES': 'Machines & Spares',
      'RAW_MATERIALS': 'Raw Materials'
    };
    return labels[category] || category;
  };

  const getCategoryBadge = (category) => {
    const badges = {
      'OILS': 'badge-blue',
      'MACHINES_SPARES': 'badge-purple',
      'RAW_MATERIALS': 'badge-green'
    };
    return badges[category] || 'badge-gray';
  };

  const getStockStatus = (product) => {
    if (product.currentStock === 0) {
      return { label: 'Out of Stock', color: 'red' };
    }
    if (product.currentStock < product.minStockLevel) {
      return { label: 'Low Stock', color: 'yellow' };
    }
    return { label: 'Healthy', color: 'green' };
  };

  if (loading) {
    return (
      <div className="container" style={{ paddingTop: '40px' }}>
        <div style={{ textAlign: 'center', padding: '60px', color: '#6b7280' }}>
          Loading products...
        </div>
      </div>
    );
  }

  return (
    <div className="container" style={{ paddingTop: '40px' }}>
      <div className="page-header">
        <h2 className="page-title">Product Management</h2>
        <p style={{ color: '#64748b', marginTop: '8px' }}>Manage all products across categories</p>
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
        <button 
          className="btn"
          onClick={() => exportToShopifyCSV(products)}
          style={{
            background: '#6366f1',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        //>
          //<span>📊</span>
          //Export for Shopify
        //</button>
        
        //<button 
          //className="btn"
          //onClick={() => exportProductsToExcel(products)}
          //style={{
            //background: '#10b981',
            //color: 'white',
            //display: 'flex',
            //alignItems: 'center',
            //gap: '8px'
          //}}
        //>
          <span>📑</span>
          Export to Excel
        </button>

        {user.role === 'admin' && (
          <button 
            className="btn btn-primary"
            onClick={() => {
              setEditingProduct(null);
              resetForm();
              setShowAddModal(true);
            }}
            style={{ marginLeft: 'auto' }}
          >
            + Add Product
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '300px' }}>
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
                onClick={() => setCategoryFilter(cat.value)}
                className="btn"
                style={{
                  background: categoryFilter === cat.value ? '#3b82f6' : 'white',
                  color: categoryFilter === cat.value ? 'white' : '#64748b',
                  border: categoryFilter === cat.value ? 'none' : '1px solid #e5e7eb',
                  fontSize: '13px',
                  padding: '8px 16px'
                }}
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
                <th>Bin Location</th>
                <th>Stock</th>
                <th>Min Level</th>
                <th>Incoming Orders</th>
                <th>Supplier</th>
                <th>Supplier Code</th>
                {user.role === 'admin' && <th>Actions</th>}
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
                    <td style={{ fontFamily: 'monospace', fontSize: '12px' }}>{product.tag}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: '12px' }}>{product.productCode}</td>
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
                          🚨 NEGATIVE STOCK
                        </span>
                      )}
                    </td>
                    <td>
                      <span className={`badge ${getCategoryBadge(product.category)}`}>
                        {getCategoryLabel(product.category)}
                      </span>
                    </td>
                    <td style={{ fontSize: '12px', color: '#64748b' }}>
                      {product.bin_location || '-'}
                    </td>
                    <td>
                      <span style={{ 
                        fontWeight: isNegative ? '900' : 'normal',
                        color: isNegative ? '#dc2626' : 'inherit',
                        fontSize: isNegative ? '15px' : 'inherit'
                      }}>
                        {product.currentStock} {product.unit}
                      </span>
                      {product.unitPerBox > 1 && (
                        <span style={{ fontSize: '11px', color: '#64748b', marginLeft: '4px' }}>
                          ({product.stockBoxes} boxes)
                        </span>
                      )}
                      {isNegative && (
                        <div style={{
                          fontSize: '11px',
                          color: '#991b1b',
                          fontWeight: '600',
                          marginTop: '4px'
                        }}>
                          ⚠️ {Math.abs(product.currentStock)} {product.unit} MISSING
                        </div>
                      )}
                    </td>
                    <td>{product.minStockLevel} {product.unit}</td>
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
                                <>
                                  <button
                                    onClick={() => handleOpenReceiveModal(product, order, idx)}
                                    style={{
                                      background: '#10b981',
                                      color: 'white',
                                      border: 'none',
                                      borderRadius: '4px',
                                      cursor: 'pointer',
                                      fontSize: '11px',
                                      padding: '4px 8px',
                                      fontWeight: '600'
                                    }}
                                    title="Mark as received"
                                  >
                                    ✓ Received
                                  </button>
                                  <button
                                    onClick={() => handleClearIncoming(product.id, idx)}
                                    style={{
                                      background: 'none',
                                      border: 'none',
                                      cursor: 'pointer',
                                      fontSize: '16px',
                                      marginLeft: 'auto',
                                      color: '#ef4444'
                                    }}
                                    title="Clear incoming order"
                                  >
                                    ✕
                                  </button>
                                </>
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
                    <td style={{ fontSize: '13px', color: '#64748b', fontFamily: 'monospace' }}>
                      {product.supplier_code || '-'}
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

      {/* Add/Edit Product Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h2>{editingProduct ? 'Edit Product' : 'Add New Product'}</h2>
              <button className="modal-close" onClick={() => setShowAddModal(false)}>×</button>
            </div>
            
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
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
                    onChange={(e) => setFormData({...formData, category: e.target.value})}
                    required
                  >
                    <option value="OILS">Oils</option>
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
                  />
                </div>

                <div className="form-group">
                  <label>Tag</label>
                  <input
                    type="text"
                    className="input"
                    value={formData.tag}
                    onChange={(e) => setFormData({...formData, tag: e.target.value})}
                  />
                </div>

                <div className="form-group">
                  <label>Unit *</label>
                  <select
                    className="input"
                    value={formData.unit}
                    onChange={(e) => setFormData({...formData, unit: e.target.value})}
                    required
                  >
                    <option value="mL">mL</option>
                    <option value="L">L</option>
                    <option value="units">units</option>
                    <option value="kg">kg</option>
                    <option value="g">g</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Current Stock</label>
                  <input
                    type="number"
                    className="input"
                    value={formData.currentStock}
                    onChange={(e) => setFormData({...formData, currentStock: parseFloat(e.target.value) || 0})}
                    min="0"
                    step="any"
                  />
                </div>

                <div className="form-group">
                  <label>Min Stock Level</label>
                  <input
                    type="number"
                    className="input"
                    value={formData.minStockLevel}
                    onChange={(e) => setFormData({...formData, minStockLevel: parseFloat(e.target.value) || 0})}
                    min="0"
                    step="any"
                  />
                </div>

                {formData.category !== 'OILS' && (
                  <div className="form-group">
                    <label>Units per Box</label>
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

                {/* Bin Location */}
                <BinLocationInput
                  category={formData.category}
                  value={formData.bin_location}
                  onChange={(value) => setFormData({...formData, bin_location: value})}
                />
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

      {/* Receive Incoming Order Modal */}
      {showReceiveModal && incomingProduct && receivingOrder && (
        <div className="modal-overlay" onClick={() => setShowReceiveModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Receive Purchase Order</h2>
              <button className="modal-close" onClick={() => setShowReceiveModal(false)}>×</button>
            </div>
            
            <form onSubmit={handleReceiveIncoming}>
              <div style={{ marginBottom: '20px', padding: '12px', background: '#f1f5f9', borderRadius: '8px' }}>
                <div style={{ fontWeight: '600', marginBottom: '4px' }}>Product:</div>
                <div style={{ fontSize: '14px', color: '#64748b' }}>{incomingProduct.name}</div>
                <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
                  PO Number: {receivingOrder.orderNumber}
                </div>
                <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
                  Expected Quantity: {receivingOrder.quantity} {incomingProduct.unit}
                </div>
              </div>

              <div className="form-group">
                <label style={{ fontWeight: '600', marginBottom: '12px', display: 'block' }}>
                  Did you receive the full quantity?
                </label>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <label style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    padding: '12px',
                    border: receivingOption === 'full' ? '2px solid #10b981' : '1px solid #e5e7eb',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    background: receivingOption === 'full' ? '#ecfdf5' : 'white'
                  }}>
                    <input
                      type="radio"
                      name="receivingOption"
                      value="full"
                      checked={receivingOption === 'full'}
                      onChange={(e) => setReceivingOption(e.target.value)}
                      style={{ marginRight: '8px' }}
                    />
                    <span style={{ fontWeight: receivingOption === 'full' ? '600' : '400' }}>
                      Yes, I received {receivingOrder.quantity} {incomingProduct.unit} in full
                    </span>
                  </label>

                  <label style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    padding: '12px',
                    border: receivingOption === 'partial' ? '2px solid #f59e0b' : '1px solid #e5e7eb',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    background: receivingOption === 'partial' ? '#fffbeb' : 'white'
                  }}>
                    <input
                      type="radio"
                      name="receivingOption"
                      value="partial"
                      checked={receivingOption === 'partial'}
                      onChange={(e) => setReceivingOption(e.target.value)}
                      style={{ marginRight: '8px' }}
                    />
                    <span style={{ fontWeight: receivingOption === 'partial' ? '600' : '400' }}>
                      No, I received a different quantity
                    </span>
                  </label>
                </div>
              </div>

              {receivingOption === 'partial' && (
                <div className="form-group">
                  <label>Quantity Received *</label>
                  <input
                    type="number"
                    className="input"
                    value={receiveFormData.quantityReceived}
                    onChange={(e) => setReceiveFormData({...receiveFormData, quantityReceived: e.target.value})}
                    placeholder={`e.g., ${receivingOrder.quantity}`}
                    min="0"
                    step="any"
                    required
                  />
                  <small style={{ fontSize: '12px', color: '#64748b', marginTop: '4px', display: 'block' }}>
                    Units: {incomingProduct.unit}
                  </small>
                </div>
              )}

              <div className="form-group">
                <label>Notes (Optional)</label>
                <textarea
                  className="input"
                  value={receiveFormData.notes}
                  onChange={(e) => setReceiveFormData({...receiveFormData, notes: e.target.value})}
                  placeholder="e.g., Received in good condition"
                  rows="3"
                />
              </div>

              <div style={{ 
                padding: '12px', 
                background: '#ecfdf5', 
                borderRadius: '8px',
                marginBottom: '20px',
                fontSize: '13px',
                color: '#065f46',
                border: '1px solid #10b981'
              }}>
                <strong>✓ Automatic Actions:</strong>
                <ul style={{ margin: '8px 0 0 20px', padding: 0 }}>
                  <li>Stock will be updated automatically (+{receivingOption === 'full' ? receivingOrder.quantity : receiveFormData.quantityReceived || '___'} {incomingProduct.unit})</li>
                  <li>Transaction will be created in History</li>
                  <li>Incoming order badge will be removed</li>
                </ul>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowReceiveModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ background: '#10b981', borderColor: '#10b981' }}>
                  Confirm & Update Stock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
