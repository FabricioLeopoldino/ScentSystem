  import { useState, useEffect } from 'react';

export default function ProductManagement() {
  const [products, setProducts] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [adjustType, setAdjustType] = useState('add'); // 'add' or 'remove'
  const [quantity, setQuantity] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  // Fetch products
  const fetchProducts = async () => {
    try {
      const response = await fetch('/api/products');
      const data = await response.json();
      setProducts(data);
    } catch (error) {
      console.error('Error fetching products:', error);
      alert('Error loading products');
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  // Open adjust modal
  const openAdjustModal = (product) => {
    console.log('📦 Opening adjust modal for:', product);
    setSelectedProduct(product);
    setShowAdjustModal(true);
    setQuantity('');
    setNotes('');
    setAdjustType('add');
  };

  // Close modal
  const closeModal = () => {
    console.log('❌ Closing modal');
    setShowAdjustModal(false);
    setSelectedProduct(null);
    setQuantity('');
    setNotes('');
  };

  // Confirm adjustment
  const handleConfirmAdjustment = async () => {
    if (!selectedProduct || !quantity || parseFloat(quantity) <= 0) {
      alert('Please enter a valid quantity');
      return;
    }

    setLoading(true);

    try {
      console.log('🚀 Sending stock adjustment:', {
        type: adjustType,
        productId: selectedProduct.id,
        quantity: parseFloat(quantity),
        notes
      });

      const endpoint = adjustType === 'add' ? '/api/stock/add' : '/api/stock/remove';
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          productId: selectedProduct.id,
          quantity: parseFloat(quantity),
          notes: notes || ''
        })
      });

      console.log('📡 Response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('❌ Error response:', errorData);
        throw new Error(errorData.error || 'Failed to adjust stock');
      }

      const data = await response.json();
      console.log('✅ Success:', data);

      alert(`Stock ${adjustType === 'add' ? 'added' : 'removed'} successfully!\nNew stock: ${data.newStock}`);
      
      // Refresh products
      await fetchProducts();
      
      // Close modal
      closeModal();

    } catch (error) {
      console.error('❌ Error adjusting stock:', error);
      alert(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Product Management</h1>

      {/* Products Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product Code</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Current Stock</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Min Level</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {products.map((product) => (
              <tr key={product.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm">{product.productCode}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">{product.name}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">{product.category}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  {product.currentStock} {product.unit}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  {product.minStockLevel} {product.unit}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <button
                    onClick={() => openAdjustModal(product)}
                    className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                  >
                    Adjust Stock
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Adjust Stock Modal */}
      {showAdjustModal && selectedProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Adjust Stock: {selectedProduct.name}</h2>
              <button
                onClick={closeModal}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ×
              </button>
            </div>

            {/* Product Info */}
            <div className="bg-gray-50 p-4 rounded mb-4">
              <div className="grid grid-cols-2 gap-4 mb-2">
                <div>
                  <div className="text-sm text-gray-500">Product Code</div>
                  <div className="font-medium">{selectedProduct.productCode}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Category</div>
                  <div className="font-medium">{selectedProduct.category}</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-gray-500">Current Stock</div>
                  <div className="font-medium text-blue-600">
                    {selectedProduct.currentStock} {selectedProduct.unit}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Min Level</div>
                  <div className="font-medium">
                    {selectedProduct.minStockLevel} {selectedProduct.unit}
                  </div>
                </div>
              </div>
            </div>

            {/* Type Selection */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    console.log('Selected: Add Stock');
                    setAdjustType('add');
                  }}
                  className={`px-4 py-2 rounded font-medium ${
                    adjustType === 'add'
                      ? 'bg-green-500 text-white'
                      : 'bg-gray-200 text-gray-700'
                  }`}
                >
                  + Add Stock
                </button>
                <button
                  onClick={() => {
                    console.log('Selected: Remove Stock');
                    setAdjustType('remove');
                  }}
                  className={`px-4 py-2 rounded font-medium ${
                    adjustType === 'remove'
                      ? 'bg-red-500 text-white'
                      : 'bg-gray-200 text-gray-700'
                  }`}
                >
                  − Remove Stock
                </button>
              </div>
            </div>

            {/* Quantity Input */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Quantity ({selectedProduct.unit})
              </label>
              <input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter quantity"
                min="0"
                step="any"
              />
            </div>

            {/* Notes Input */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Notes (optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Add notes about this adjustment..."
                rows="3"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={closeModal}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 font-medium"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmAdjustment}
                className={`flex-1 px-4 py-2 rounded font-medium text-white ${
                  loading
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-green-500 hover:bg-green-600'
                }`}
                disabled={loading}
              >
                {loading ? 'Processing...' : 'Confirm Adjustment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
