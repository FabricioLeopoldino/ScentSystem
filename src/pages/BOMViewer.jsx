import { useState, useEffect } from 'react';

export default function BOMViewer({ user }) {
  const [bom, setBom] = useState({});
  const [selectedVariant, setSelectedVariant] = useState('SA_CA');
  const [products, setProducts] = useState([]);
  const [rawMaterials, setRawMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingComponent, setEditingComponent] = useState(null);
  const [formData, setFormData] = useState({
    componentCode: '',
    componentName: '',
    quantity: 1
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [bomRes, productsRes] = await Promise.all([
        fetch('/api/bom'),
        fetch('/api/products')
      ]);
      
      const bomData = await bomRes.json();
      const productsData = await productsRes.json();
      
      setBom(bomData);
      setProducts(productsData);
      setRawMaterials(productsData.filter(p => p.category === 'RAW_MATERIALS'));
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getProductByCode = (code) => {
    return products.find(p => p.productCode === code);
  };

  const getVariantName = (variant) => {
    const names = {
      'SA_CA': 'Oil Cartridge (400ml)',
      'SA_HF': '500ml Refill Bottle',
      'SA_CDIFF': '700ml Oil Refill',
      'SA_1L': '1L Refill Bottle',
      'SA_PRO': '1L PRO Bottle'
    };
    return names[variant] || variant;
  };

  const getVariantVolume = (variant) => {
    const volumes = {
      'SA_CA': 400,
      'SA_HF': 500,
      'SA_CDIFF': 700,
      'SA_1L': 1000,
      'SA_PRO': 1000
    };
    return volumes[variant] || 0;
  };

  const getVariantColor = (variant) => {
    const colors = {
      'SA_CA': '#667eea',
      'SA_HF': '#fa709a',
      'SA_CDIFF': '#4facfe',
      'SA_1L': '#f093fb',
      'SA_PRO': '#43e97b'
    };
    return colors[variant] || '#667eea';
  };

  const handleAddComponent = async (e) => {
    e.preventDefault();
    
    try {
      const res = await fetch(`/api/bom/${selectedVariant}/component`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      
      if (res.ok) {
        const data = await res.json();
        setBom(prev => ({ ...prev, [selectedVariant]: data.bom }));
        setShowAddModal(false);
        resetForm();
        alert('Component added successfully!');
      } else {
        const error = await res.json();
        alert(error.error || 'Error adding component');
      }
    } catch (error) {
      alert('Error adding component: ' + error.message);
    }
  };

  const handleEditComponent = async (e) => {
    e.preventDefault();
    
    try {
      const res = await fetch(`/api/bom/${selectedVariant}/component/${editingComponent.componentCode}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          componentName: formData.componentName,
          quantity: formData.quantity
        })
      });
      
      if (res.ok) {
        const data = await res.json();
        setBom(prev => ({ ...prev, [selectedVariant]: data.bom }));
        setShowEditModal(false);
        setEditingComponent(null);
        resetForm();
        alert('Component updated successfully!');
      } else {
        const error = await res.json();
        alert(error.error || 'Error updating component');
      }
    } catch (error) {
      alert('Error updating component: ' + error.message);
    }
  };

  const handleDeleteComponent = async (componentCode) => {
    if (!confirm('Are you sure you want to remove this component from the BOM?')) return;
    
    try {
      const res = await fetch(`/api/bom/${selectedVariant}/component/${componentCode}`, {
        method: 'DELETE'
      });
      
      if (res.ok) {
        const data = await res.json();
        setBom(prev => ({ ...prev, [selectedVariant]: data.bom }));
        alert('Component removed successfully!');
      } else {
        const error = await res.json();
        alert(error.error || 'Error removing component');
      }
    } catch (error) {
      alert('Error removing component: ' + error.message);
    }
  };

  const openEditModal = (component) => {
    setEditingComponent(component);
    setFormData({
      componentCode: component.componentCode,
      componentName: component.componentName,
      quantity: component.quantity
    });
    setShowEditModal(true);
  };

  const resetForm = () => {
    setFormData({
      componentCode: '',
      componentName: '',
      quantity: 1
    });
  };

  const handleRawMaterialSelect = (e) => {
    const code = e.target.value;
    const rm = rawMaterials.find(r => r.productCode === code);
    if (rm) {
      setFormData({
        componentCode: rm.productCode,
        componentName: rm.name,
        quantity: 1
      });
    }
  };

  const currentBOM = bom[selectedVariant] || [];
  const isAdmin = user?.role === 'admin';

  if (loading) {
    return (
      <div className="container" style={{ paddingTop: '40px' }}>
        <div style={{ textAlign: 'center', padding: '60px', color: '#6b7280' }}>
          Loading BOM data...
        </div>
      </div>
    );
  }

  return (
    <div className="container" style={{ paddingTop: '40px' }}>
      <div className="page-header">
        <div>
          <h2 className="page-title">BILL OF MATERIALS (BOM)</h2>
          <p>Manage components required for each product variant</p>
        </div>
        {isAdmin && (
          <button 
            className="btn btn-primary"
            onClick={() => {
              resetForm();
              setShowAddModal(true);
            }}
          >
            + Add Component
          </button>
        )}
      </div>

      {/* Variant Selector */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          {Object.keys(bom).map(variant => (
            <button
              key={variant}
              className={`btn ${selectedVariant === variant ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setSelectedVariant(variant)}
              style={selectedVariant === variant ? { background: getVariantColor(variant), borderColor: getVariantColor(variant) } : {}}
            >
              {getVariantName(variant)}
            </button>
          ))}
        </div>
      </div>

      {/* Variant Info */}
      <div className="card" style={{ marginBottom: '24px', borderLeft: `4px solid ${getVariantColor(selectedVariant)}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h3 style={{ color: getVariantColor(selectedVariant), marginBottom: '8px', fontSize: '20px' }}>
              {getVariantName(selectedVariant)}
            </h3>
            <p style={{ color: '#64748b', margin: 0 }}>
              Components required to produce one unit of {getVariantName(selectedVariant)}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '24px' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: '700', color: getVariantColor(selectedVariant) }}>
                {getVariantVolume(selectedVariant)} mL
              </div>
              <div style={{ fontSize: '12px', color: '#64748b' }}>Oil Volume</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: '700', color: '#10b981' }}>
                {currentBOM.length}
              </div>
              <div style={{ fontSize: '12px', color: '#64748b' }}>Components</div>
            </div>
          </div>
        </div>
      </div>

      {/* BOM Table */}
      <div className="card">
        {currentBOM.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px', color: '#9ca3af' }}>
            <p style={{ fontSize: '18px', marginBottom: '16px' }}>No components defined for this variant</p>
            {isAdmin && (
              <button 
                className="btn btn-primary"
                onClick={() => {
                  resetForm();
                  setShowAddModal(true);
                }}
              >
                + Add First Component
              </button>
            )}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: '60px' }}>#</th>
                  <th>Component Code</th>
                  <th>Component Name</th>
                  <th style={{ width: '100px' }}>Quantity</th>
                  <th>Current Stock</th>
                  <th>Status</th>
                  {isAdmin && <th style={{ width: '150px' }}>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {currentBOM.map((item, index) => {
                  const product = getProductByCode(item.componentCode);
                  const currentStock = product ? product.currentStock : 0;
                  const minStock = product ? product.minStockLevel : 0;
                  const isLow = currentStock <= minStock;

                  return (
                    <tr key={item.componentCode || index}>
                      <td style={{ fontWeight: '600', color: '#64748b' }}>{item.seq || index + 1}</td>
                      <td>
                        <span style={{ fontFamily: 'monospace', fontSize: '13px', fontWeight: '600', color: '#2563eb' }}>
                          {item.componentCode}
                        </span>
                      </td>
                      <td style={{ fontWeight: '600' }}>{item.componentName}</td>
                      <td>
                        <span style={{ 
                          background: '#f1f5f9', 
                          padding: '4px 12px', 
                          borderRadius: '4px',
                          fontWeight: '600'
                        }}>
                          {item.quantity} unit{item.quantity > 1 ? 's' : ''}
                        </span>
                      </td>
                      <td>
                        {product ? (
                          <span style={{ fontWeight: '600' }}>
                            {currentStock} {product.unit}
                          </span>
                        ) : (
                          <span style={{ color: '#9ca3af' }}>N/A</span>
                        )}
                      </td>
                      <td>
                        {product ? (
                          <span className={`badge ${isLow ? 'badge-danger' : 'badge-success'}`}>
                            {isLow ? 'Low Stock' : 'Available'}
                          </span>
                        ) : (
                          <span className="badge badge-warning">Not Found</span>
                        )}
                      </td>
                      {isAdmin && (
                        <td>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button 
                              className="btn btn-secondary"
                              onClick={() => openEditModal(item)}
                              style={{ fontSize: '12px', padding: '4px 12px' }}
                            >
                              Edit
                            </button>
                            <button 
                              className="btn btn-danger"
                              onClick={() => handleDeleteComponent(item.componentCode)}
                              style={{ fontSize: '12px', padding: '4px 12px' }}
                            >
                              Remove
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
        )}
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginTop: '24px' }}>
        <div className="card" style={{ textAlign: 'center', padding: '20px' }}>
          <div style={{ fontSize: '32px', fontWeight: '900', color: '#3b82f6', marginBottom: '8px' }}>
            {currentBOM.length}
          </div>
          <div style={{ fontSize: '13px', color: '#64748b', fontWeight: '600' }}>Total Components</div>
        </div>
        
        <div className="card" style={{ textAlign: 'center', padding: '20px' }}>
          <div style={{ fontSize: '32px', fontWeight: '900', color: '#ef4444', marginBottom: '8px' }}>
            {currentBOM.filter(item => {
              const product = getProductByCode(item.componentCode);
              return product && product.currentStock <= product.minStockLevel;
            }).length}
          </div>
          <div style={{ fontSize: '13px', color: '#64748b', fontWeight: '600' }}>Low Stock Components</div>
        </div>
        
        <div className="card" style={{ textAlign: 'center', padding: '20px' }}>
          <div style={{ fontSize: '32px', fontWeight: '900', color: '#8b5cf6', marginBottom: '8px' }}>
            {Object.keys(bom).length}
          </div>
          <div style={{ fontSize: '13px', color: '#64748b', fontWeight: '600' }}>Total Variants</div>
        </div>
        
        <div className="card" style={{ textAlign: 'center', padding: '20px' }}>
          <div style={{ fontSize: '32px', fontWeight: '900', color: '#10b981', marginBottom: '8px' }}>
            {rawMaterials.length}
          </div>
          <div style={{ fontSize: '13px', color: '#64748b', fontWeight: '600' }}>Available Raw Materials</div>
        </div>
      </div>

      {/* Add Component Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Add Component to {getVariantName(selectedVariant)}</h2>
              <button className="modal-close" onClick={() => setShowAddModal(false)}>×</button>
            </div>
            
            <form onSubmit={handleAddComponent}>
              <div className="form-group">
                <label>Select Raw Material</label>
                <select
                  className="input"
                  onChange={handleRawMaterialSelect}
                  value={formData.componentCode}
                >
                  <option value="">-- Select a Raw Material --</option>
                  {rawMaterials.map(rm => (
                    <option key={rm.productCode} value={rm.productCode}>
                      {rm.productCode} - {rm.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Component Code</label>
                <input
                  type="text"
                  className="input"
                  value={formData.componentCode}
                  onChange={(e) => setFormData({...formData, componentCode: e.target.value})}
                  placeholder="e.g., SA_RM_00003"
                  required
                />
              </div>

              <div className="form-group">
                <label>Component Name</label>
                <input
                  type="text"
                  className="input"
                  value={formData.componentName}
                  onChange={(e) => setFormData({...formData, componentName: e.target.value})}
                  placeholder="e.g., Empty Oil Cartridge (400ml)"
                  required
                />
              </div>

              <div className="form-group">
                <label>Quantity per Unit</label>
                <input
                  type="number"
                  className="input"
                  value={formData.quantity}
                  onChange={(e) => setFormData({...formData, quantity: parseInt(e.target.value) || 1})}
                  min="1"
                  required
                />
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Add Component
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Component Modal */}
      {showEditModal && editingComponent && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Edit Component</h2>
              <button className="modal-close" onClick={() => setShowEditModal(false)}>×</button>
            </div>
            
            <form onSubmit={handleEditComponent}>
              <div className="form-group">
                <label>Component Code</label>
                <input
                  type="text"
                  className="input"
                  value={formData.componentCode}
                  disabled
                  style={{ background: '#f1f5f9' }}
                />
              </div>

              <div className="form-group">
                <label>Component Name</label>
                <input
                  type="text"
                  className="input"
                  value={formData.componentName}
                  onChange={(e) => setFormData({...formData, componentName: e.target.value})}
                  required
                />
              </div>

              <div className="form-group">
                <label>Quantity per Unit</label>
                <input
                  type="number"
                  className="input"
                  value={formData.quantity}
                  onChange={(e) => setFormData({...formData, quantity: parseInt(e.target.value) || 1})}
                  min="1"
                  required
                />
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowEditModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Update Component
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
