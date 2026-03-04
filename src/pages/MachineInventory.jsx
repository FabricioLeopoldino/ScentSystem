import { useState, useEffect } from 'react';

export default function MachineInventory({ user }) {
  const [machines, setMachines] = useState([]);
  const [filteredMachines, setFilteredMachines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [subCategoryFilter, setSubCategoryFilter] = useState('ALL');
  const [colorFilter, setColorFilter] = useState('ALL');
  const [locationFilter, setLocationFilter] = useState('ALL');
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingMachine, setEditingMachine] = useState(null);
  const [showIncomingModal, setShowIncomingModal] = useState(false);
  const [incomingMachine, setIncomingMachine] = useState(null);
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [receivingOrder, setReceivingOrder] = useState(null);
  const [receivingIndex, setReceivingIndex] = useState(null);
  
  const [formData, setFormData] = useState({
    name: '',
    sub_category: '',
    color: '',
    location: '',
    supplier: '',
    supplier_code: '',
    productCode: '',
    tag: '',
    currentStock: 0,
    minStockLevel: 0,
    shopifySkus: ''
  });
  
  const [incomingFormData, setIncomingFormData] = useState({
    orderNumber: '',
    quantity: '',
    notes: ''
  });
  
  const [receivingOption, setReceivingOption] = useState('full');
  const [receiveFormData, setReceiveFormData] = useState({
    quantityReceived: '',
    notes: ''
  });

  useEffect(() => {
    fetchMachines();
  }, []);

  useEffect(() => {
    filterMachines();
  }, [machines, searchTerm, subCategoryFilter, colorFilter, locationFilter]);

  const fetchMachines = async () => {
    try {
      const res = await fetch('/api/products');
      const data = await res.json();
      // Filter only SCENT_MACHINES category
      const machineData = data.filter(p => p.category === 'SCENT_MACHINES');
      setMachines(machineData);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching machines:', error);
      setLoading(false);
    }
  };

  const filterMachines = () => {
    let filtered = machines;
    
    if (subCategoryFilter !== 'ALL') {
      filtered = filtered.filter(m => m.sub_category === subCategoryFilter);
    }
    
    if (colorFilter !== 'ALL') {
      filtered = filtered.filter(m => m.color === colorFilter);
    }
    
    if (locationFilter !== 'ALL') {
      filtered = filtered.filter(m => m.location === locationFilter);
    }
    
    if (searchTerm) {
      filtered = filtered.filter(m => 
        m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.productCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.tag.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (m.supplier && m.supplier.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (m.sub_category && m.sub_category.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }
    
    setFilteredMachines(filtered);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      const url = editingMachine 
        ? `/api/products/${editingMachine.id}`
        : '/api/products';
      
      const method = editingMachine ? 'PUT' : 'POST';
      
      // Convert shopifySkus string to object
      let skusObject = {};
      if (formData.shopifySkus && formData.shopifySkus.trim()) {
        const skusArray = formData.shopifySkus.split(',').map(s => s.trim()).filter(Boolean);
        skusArray.forEach(sku => {
          skusObject[sku] = sku;
        });
      }
      
      const payload = {
        ...formData,
        shopifySkus: skusObject,
        category: 'SCENT_MACHINES',
        unit: 'units'
      };
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (res.ok) {
        alert(editingMachine ? 'Machine updated!' : 'Machine added!');
        setShowAddModal(false);
        setEditingMachine(null);
        resetForm();
        fetchMachines();
      }
    } catch (error) {
      alert('Error saving machine: ' + error.message);
    }
  };

  const handleDelete = async (machineId) => {
    if (!confirm('Are you sure you want to delete this machine?')) return;
    
    try {
      const res = await fetch(`/api/products/${machineId}`, {
        method: 'DELETE'
      });
      
      if (res.ok) {
        alert('Machine deleted!');
        fetchMachines();
      }
    } catch (error) {
      alert('Error deleting machine: ' + error.message);
    }
  };

  const handleEdit = (machine) => {
    setEditingMachine(machine);
    setFormData({
      name: machine.name,
      sub_category: machine.sub_category || '',
      color: machine.color || '',
      location: machine.location || '',
      supplier: machine.supplier || '',
      supplier_code: machine.supplier_code || '',
      productCode: machine.productCode,
      tag: machine.tag,
      currentStock: machine.currentStock,
      minStockLevel: machine.minStockLevel,
      shopifySkus: Object.keys(machine.shopifySkus || {}).join(', ') || ''
    });
    setShowAddModal(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      sub_category: '',
      color: '',
      location: '',
      supplier: '',
      supplier_code: '',
      productCode: '',
      tag: '',
      currentStock: 0,
      minStockLevel: 0,
      shopifySkus: ''
    });
  };

  const handleOpenIncomingModal = (machine) => {
    setIncomingMachine(machine);
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
      const res = await fetch(`/api/products/${incomingMachine.id}/incoming`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderNumber: incomingFormData.orderNumber,
          quantity: parseFloat(incomingFormData.quantity),
          supplier: incomingMachine.supplier,
          notes: incomingFormData.notes,
          addedBy: user?.username || 'admin'
        })
      });
      
      if (res.ok) {
        alert('Incoming order added successfully!');
        setShowIncomingModal(false);
        setIncomingMachine(null);
        setIncomingFormData({ orderNumber: '', quantity: '', notes: '' });
        fetchMachines();
      } else {
        const error = await res.json();
        alert(error.error || 'Error adding incoming order');
      }
    } catch (error) {
      alert('Error adding incoming order: ' + error.message);
    }
  };

  const handleClearIncoming = async (machineId, index) => {
    if (!confirm('Clear this incoming order?')) return;
    
    try {
      const res = await fetch(`/api/products/${machineId}/incoming/${index}`, {
        method: 'DELETE'
      });
      
      if (res.ok) {
        alert('Incoming order cleared!');
        fetchMachines();
      }
    } catch (error) {
      alert('Error clearing incoming order: ' + error.message);
    }
  };

  const handleOpenReceiveModal = (machine, order, index) => {
    setIncomingMachine(machine);
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
      const res = await fetch(`/api/products/${incomingMachine.id}/incoming/${receivingIndex}/receive`, {
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
        alert(`Stock updated successfully! New stock: ${data.newStock} units`);
        setShowReceiveModal(false);
        setIncomingMachine(null);
        setReceivingOrder(null);
        setReceivingIndex(null);
        setReceivingOption('full');
        setReceiveFormData({ quantityReceived: '', notes: '' });
        fetchMachines();
      } else {
        const error = await res.json();
        alert(error.error || 'Error receiving incoming order');
      }
    } catch (error) {
      alert('Error receiving incoming order: ' + error.message);
    }
  };

  const getStockStatus = (machine) => {
    if (machine.currentStock < 0) {
      return { label: 'Negative Stock', color: 'red' };
    }
    if (machine.currentStock === 0) {
      return { label: 'Out of Stock', color: 'red' };
    }
    if (machine.currentStock < machine.minStockLevel) {
      return { label: 'Low Stock', color: 'yellow' };
    }
    return { label: 'In Stock', color: 'green' };
  };

  const uniqueSubCategories = [...new Set(machines.map(m => m.sub_category).filter(Boolean))];
  const uniqueColors = [...new Set(machines.map(m => m.color).filter(Boolean))];
  const uniqueLocations = [...new Set(machines.map(m => m.location).filter(Boolean))];

  const totalMachines = machines.length;
  const inStock = machines.filter(m => m.currentStock > 0).length;
  const lowStock = machines.filter(m => m.currentStock > 0 && m.currentStock < m.minStockLevel).length;
  const outOfStock = machines.filter(m => m.currentStock === 0).length;

  if (loading) {
    return (
      <div className="container" style={{ paddingTop: '40px' }}>
        <div style={{ textAlign: 'center', padding: '60px', color: '#6b7280' }}>
          Loading machines...
        </div>
      </div>
    );
  }

  return (
    <div className="container" style={{ paddingTop: '40px' }}>
      <div className="page-header">
        <h2 className="page-title">Machine Inventory</h2>
        <p style={{ color: '#64748b', marginTop: '8px' }}>Manage all Scent diffusion machines</p>
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '32px' }}>
        <div className="card" style={{ borderLeft: '4px solid #3b82f6' }}>
          <h3 style={{ fontSize: '14px', fontWeight: '700', color: '#64748b', marginBottom: '12px', textTransform: 'uppercase' }}>
            Total Machines
          </h3>
          <div style={{ fontSize: '32px', fontWeight: '900', color: '#3b82f6' }}>
            {totalMachines}
          </div>
        </div>

        <div className="card" style={{ borderLeft: '4px solid #10b981' }}>
          <h3 style={{ fontSize: '14px', fontWeight: '700', color: '#64748b', marginBottom: '12px', textTransform: 'uppercase' }}>
            In Stock
          </h3>
          <div style={{ fontSize: '32px', fontWeight: '900', color: '#10b981' }}>
            {inStock}
          </div>
        </div>

        <div className="card" style={{ borderLeft: '4px solid #f59e0b' }}>
          <h3 style={{ fontSize: '14px', fontWeight: '700', color: '#64748b', marginBottom: '12px', textTransform: 'uppercase' }}>
            Low Stock
          </h3>
          <div style={{ fontSize: '32px', fontWeight: '900', color: '#f59e0b' }}>
            {lowStock}
          </div>
        </div>

        <div className="card" style={{ borderLeft: '4px solid #ef4444' }}>
          <h3 style={{ fontSize: '14px', fontWeight: '700', color: '#64748b', marginBottom: '12px', textTransform: 'uppercase' }}>
            Out of Stock
          </h3>
          <div style={{ fontSize: '32px', fontWeight: '900', color: '#ef4444' }}>
            {outOfStock}
          </div>
        </div>
      </div>

      {/* Action Button */}
      {user.role === 'admin' && (
        <div style={{ marginBottom: '24px' }}>
          <button 
            className="btn btn-primary"
            onClick={() => {
              setEditingMachine(null);
              resetForm();
              setShowAddModal(true);
            }}
          >
            + Add Machine
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
          <div>
            <label style={{ fontSize: '13px', fontWeight: '600', color: '#64748b', marginBottom: '8px', display: 'block' }}>
              Search
            </label>
            <input
              type="text"
              className="input"
              placeholder="Search by name, code, supplier..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div>
            <label style={{ fontSize: '13px', fontWeight: '600', color: '#64748b', marginBottom: '8px', display: 'block' }}>
              SubCategory
            </label>
            <select
              className="input"
              value={subCategoryFilter}
              onChange={(e) => setSubCategoryFilter(e.target.value)}
            >
              <option value="ALL">All SubCategories</option>
              {uniqueSubCategories.map(sub => (
                <option key={sub} value={sub}>{sub}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ fontSize: '13px', fontWeight: '600', color: '#64748b', marginBottom: '8px', display: 'block' }}>
              Color
            </label>
            <select
              className="input"
              value={colorFilter}
              onChange={(e) => setColorFilter(e.target.value)}
            >
              <option value="ALL">All Colors</option>
              {uniqueColors.map(color => (
                <option key={color} value={color}>{color}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ fontSize: '13px', fontWeight: '600', color: '#64748b', marginBottom: '8px', display: 'block' }}>
              Location
            </label>
            <select
              className="input"
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
            >
              <option value="ALL">All Locations</option>
              {uniqueLocations.map(loc => (
                <option key={loc} value={loc}>{loc}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Machines Table */}
      <div className="card">
        <div style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Supplier</th>
                <th>SubCategory</th>
                <th>Name</th>
                <th>Color</th>
                <th>Location</th>
                <th>Shopify SKU</th>
                <th>Stock</th>
                <th>Min Level</th>
                <th>Status</th>
                <th>Incoming Orders</th>
                {user.role === 'admin' && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {filteredMachines.map(machine => {
                const status = getStockStatus(machine);
                const isNegative = machine.currentStock < 0;
                return (
                  <tr 
                    key={machine.id}
                    style={isNegative ? {
                      background: '#fef2f2',
                      borderLeft: '4px solid #dc2626'
                    } : {}}
                  >
                    <td style={{ fontSize: '13px' }}>{machine.supplier || '-'}</td>
                    <td>
                      <span className="badge" style={{ background: '#8b5cf6', color: 'white', fontSize: '11px' }}>
                        {machine.sub_category || '-'}
                      </span>
                    </td>
                    <td style={{ fontWeight: '600' }}>
                      {machine.name}
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
                      {machine.color ? (
                        <span style={{ 
                          padding: '4px 8px', 
                          background: '#f3f4f6', 
                          borderRadius: '4px',
                          fontSize: '12px',
                          fontWeight: '600'
                        }}>
                          {machine.color}
                        </span>
                      ) : '-'}
                    </td>
                    <td style={{ fontSize: '13px', color: '#64748b' }}>
                      {machine.location || '-'}
                    </td>
                    <td style={{ fontFamily: 'monospace', fontSize: '12px' }}>
                      {Object.keys(machine.shopifySkus || {}).join(', ') || '-'}
                    </td>
                    <td>
                      <span style={{ 
                        fontWeight: isNegative ? '900' : '600',
                        color: isNegative ? '#dc2626' : 'inherit',
                        fontSize: isNegative ? '15px' : 'inherit'
                      }}>
                        {machine.currentStock} units
                      </span>
                      {isNegative && (
                        <div style={{
                          fontSize: '11px',
                          color: '#991b1b',
                          fontWeight: '600',
                          marginTop: '4px'
                        }}>
                          ⚠️ {Math.abs(machine.currentStock)} units MISSING
                        </div>
                      )}
                    </td>
                    <td>{machine.minStockLevel} units</td>
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
                        <span className={status.color} style={{ fontWeight: '600' }}>{status.label}</span>
                      )}
                    </td>
                    <td>
                      {machine.incomingOrders && machine.incomingOrders.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          {machine.incomingOrders.map((order, idx) => (
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
                                ({order.quantity} units)
                              </span>
                              {user.role === 'admin' && (
                                <>
                                  <button
                                    onClick={() => handleOpenReceiveModal(machine, order, idx)}
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
                                    onClick={() => handleClearIncoming(machine.id, idx)}
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
                    {user.role === 'admin' && (
                      <td>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          <button 
                            className="btn btn-secondary"
                            onClick={() => handleEdit(machine)}
                            style={{ fontSize: '12px', padding: '6px 12px' }}
                          >
                            Edit
                          </button>
                          <button 
                            className="btn"
                            onClick={() => handleOpenIncomingModal(machine)}
                            style={{ 
                              fontSize: '12px', 
                              padding: '6px 12px',
                              background: '#f59e0b',
                              color: 'white',
                              border: 'none'
                            }}
                          >
                            + Incoming
                          </button>
                          <button 
                            className="btn btn-danger"
                            onClick={() => handleDelete(machine.id)}
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
          Showing {filteredMachines.length} of {machines.length} machines
        </div>
      </div>

      {/* Add/Edit Machine Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '700px' }}>
            <div className="modal-header">
              <h2>{editingMachine ? 'Edit Machine' : 'Add New Machine'}</h2>
              <button className="modal-close" onClick={() => setShowAddModal(false)}>×</button>
            </div>
            
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label>Machine Name *</label>
                  <input
                    type="text"
                    className="input"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>SubCategory</label>
                  <input
                    type="text"
                    className="input"
                    value={formData.sub_category}
                    onChange={(e) => setFormData({...formData, sub_category: e.target.value})}
                    placeholder="e.g., HVAC, Scentpro, Scentlite"
                  />
                </div>

                <div className="form-group">
                  <label>Color</label>
                  <input
                    type="text"
                    className="input"
                    value={formData.color}
                    onChange={(e) => setFormData({...formData, color: e.target.value})}
                    placeholder="e.g., Black, White"
                  />
                </div>

                <div className="form-group">
                  <label>Location</label>
                  <input
                    type="text"
                    className="input"
                    value={formData.location}
                    onChange={(e) => setFormData({...formData, location: e.target.value})}
                    placeholder="e.g., Warehouse A, Production Floor"
                  />
                </div>

                <div className="form-group">
                  <label>Supplier</label>
                  <input
                    type="text"
                    className="input"
                    value={formData.supplier}
                    onChange={(e) => setFormData({...formData, supplier: e.target.value})}
                    placeholder="e.g., ECO, ov-10"
                  />
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

                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label>Shopify SKUs (comma-separated)</label>
                  <input
                    type="text"
                    className="input"
                    value={formData.shopifySkus}
                    onChange={(e) => setFormData({...formData, shopifySkus: e.target.value})}
                    placeholder="e.g., SA_0001, SA_0002"
                  />
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                    Enter multiple SKUs separated by commas
                  </div>
                </div>

                <div className="form-group">
                  <label>Current Stock</label>
                  <input
                    type="number"
                    className="input"
                    value={formData.currentStock}
                    onChange={(e) => setFormData({...formData, currentStock: parseFloat(e.target.value) || 0})}
                    min="0"
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
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingMachine ? 'Update Machine' : 'Add Machine'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Incoming Order Modal */}
      {showIncomingModal && incomingMachine && (
        <div className="modal-overlay" onClick={() => setShowIncomingModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Add Incoming Order - Purchase Order</h2>
              <button className="modal-close" onClick={() => setShowIncomingModal(false)}>×</button>
            </div>
            
            <form onSubmit={handleAddIncoming}>
              <div style={{ marginBottom: '20px', padding: '12px', background: '#f1f5f9', borderRadius: '8px' }}>
                <div style={{ fontWeight: '600', marginBottom: '4px' }}>Machine:</div>
                <div style={{ fontSize: '14px', color: '#64748b' }}>{incomingMachine.name}</div>
                <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
                  {incomingMachine.sub_category} • {incomingMachine.color || 'No color'}
                </div>
              </div>

              <div className="form-group">
                <label>PO Number *</label>
                <input
                  type="text"
                  className="input"
                  value={incomingFormData.orderNumber}
                  onChange={(e) => setIncomingFormData({...incomingFormData, orderNumber: e.target.value})}
                  placeholder="e.g., #PO166"
                  required
                />
              </div>

              <div className="form-group">
                <label>Quantity *</label>
                <input
                  type="number"
                  className="input"
                  value={incomingFormData.quantity}
                  onChange={(e) => setIncomingFormData({...incomingFormData, quantity: e.target.value})}
                  placeholder="e.g., 50"
                  min="0"
                  required
                />
              </div>

              <div className="form-group">
                <label>Notes (Optional)</label>
                <textarea
                  className="input"
                  value={incomingFormData.notes}
                  onChange={(e) => setIncomingFormData({...incomingFormData, notes: e.target.value})}
                  placeholder="e.g., Expected arrival date, special instructions"
                  rows="3"
                />
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
      {showReceiveModal && incomingMachine && receivingOrder && (
        <div className="modal-overlay" onClick={() => setShowReceiveModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Receive Purchase Order</h2>
              <button className="modal-close" onClick={() => setShowReceiveModal(false)}>×</button>
            </div>
            
            <form onSubmit={handleReceiveIncoming}>
              <div style={{ marginBottom: '20px', padding: '12px', background: '#f1f5f9', borderRadius: '8px' }}>
                <div style={{ fontWeight: '600', marginBottom: '4px' }}>Machine:</div>
                <div style={{ fontSize: '14px', color: '#64748b' }}>{incomingMachine.name}</div>
                <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
                  PO: {receivingOrder.orderNumber} • Expected: {receivingOrder.quantity} units
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
                    <span>Yes, received {receivingOrder.quantity} units in full</span>
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
                    <span>No, received a different quantity</span>
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
                    min="0"
                    required
                  />
                </div>
              )}

              <div className="form-group">
                <label>Notes (Optional)</label>
                <textarea
                  className="input"
                  value={receiveFormData.notes}
                  onChange={(e) => setReceiveFormData({...receiveFormData, notes: e.target.value})}
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
                  <li>Stock will be updated automatically</li>
                  <li>Transaction will be created in History</li>
                  <li>Incoming order badge will be removed</li>
                </ul>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowReceiveModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ background: '#10b981' }}>
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
