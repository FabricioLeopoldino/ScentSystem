import * as XLSX from 'xlsx';

// Helper functions for consistent formatting
const getCategoryLabel = (category) => {
  const labels = {
    'OILS': 'Oils',
    'MACHINES_SPARES': 'Machines & Spares',
    'RAW_MATERIALS': 'Raw Materials',
    'SCENT_MACHINES': 'Machines'
  };
  return labels[category] || category;
};

const getTransactionTypeLabel = (type) => {
  const labels = {
    'add': 'Add Stock',
    'remove': 'Remove Stock',
    'return': 'Return to Stock',
    'incoming': 'Incoming Order',
    'adjust': 'Adjustment',
    'shopify_sale': 'Shopify Sale'
  };
  return labels[type] || type;
};

export function exportProductsToExcel(products) {
  // Prepare data for export
  const data = products.map(product => ({
    'Tag': product.tag,
    'Product Code': product.productCode,
    'Name': product.name,
    'Category': getCategoryLabel(product.category),
    'Sub Category': product.sub_category || '-',
    'Color': product.color || '-',
    'Location': product.location || '-',
    'Current Stock': product.currentStock,
    'Unit': product.unit,
    'Stock (Boxes)': product.stockBoxes || '-',
    'Units Per Box': product.unitPerBox || '-',
    'Min Stock Level': product.minStockLevel,
    'Supplier': product.supplier || '-',
    'Supplier Code': product.supplier_code || '-',
    'Shopify SKUs': Object.keys(product.shopifySkus || {}).join(', ') || '-',
    'Created At': product.createdAt ? new Date(product.createdAt).toLocaleDateString() : '-'
  }));

  // Create worksheet
  const ws = XLSX.utils.json_to_sheet(data);
  
  // Set column widths
  ws['!cols'] = [
    { wch: 15 }, // Tag
    { wch: 15 }, // Product Code
    { wch: 40 }, // Name
    { wch: 20 }, // Category
    { wch: 15 }, // Sub Category
    { wch: 10 }, // Color
    { wch: 15 }, // Location
    { wch: 12 }, // Current Stock
    { wch: 8 },  // Unit
    { wch: 12 }, // Stock (Boxes)
    { wch: 12 }, // Units Per Box
    { wch: 15 }, // Min Stock Level
    { wch: 20 }, // Supplier
    { wch: 15 }, // Supplier Code
    { wch: 30 }, // Shopify SKUs
    { wch: 12 }  // Created At
  ];

  // Create workbook
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Products');

  // Generate filename with timestamp
  const timestamp = new Date().toISOString().split('T')[0];
  const filename = `Products_Export_${timestamp}.xlsx`;

  // Download file
  XLSX.writeFile(wb, filename);
}

export function exportTransactionsToExcel(transactions) {
  // Prepare data for export
  const data = transactions.map(tx => ({
    'Transaction ID': tx.id,
    'Date': new Date(tx.created_at || tx.createdAt).toLocaleString(),
    'Product Code': tx.product_code || tx.productCode || '-',
    'Product Name': tx.product_name || tx.productName || '-',
    'Category': getCategoryLabel(tx.category),
    'Type': getTransactionTypeLabel(tx.type),
    'Quantity': tx.quantity,
    'Unit': tx.unit,
    'Balance After': tx.balance_after || tx.balanceAfter || '-',
    'Notes': tx.notes || '-',
    'Shopify Order': tx.shopify_order_id || tx.shopifyOrderId || '-'
  }));

  // Create worksheet
  const ws = XLSX.utils.json_to_sheet(data);
  
  // Set column widths
  ws['!cols'] = [
    { wch: 12 }, // Transaction ID
    { wch: 18 }, // Date
    { wch: 15 }, // Product Code
    { wch: 30 }, // Product Name
    { wch: 20 }, // Category
    { wch: 18 }, // Type
    { wch: 10 }, // Quantity
    { wch: 8 },  // Unit
    { wch: 12 }, // Balance After
    { wch: 40 }, // Notes
    { wch: 15 }  // Shopify Order
  ];

  // Create workbook
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Transactions');

  // Generate filename with timestamp
  const timestamp = new Date().toISOString().split('T')[0];
  const filename = `Transactions_Export_${timestamp}.xlsx`;

  // Download file
  XLSX.writeFile(wb, filename);
}

export function exportFullDatabaseToExcel(products, transactions) {
  const wb = XLSX.utils.book_new();

  // Products sheet
  const productsData = products.map(product => ({
    'Tag': product.tag,
    'Product Code': product.productCode,
    'Name': product.name,
    'Category': getCategoryLabel(product.category),
    'Sub Category': product.sub_category || '-',
    'Color': product.color || '-',
    'Location': product.location || '-',
    'Current Stock': product.currentStock,
    'Unit': product.unit,
    'Stock (Boxes)': product.stockBoxes || '-',
    'Units Per Box': product.unitPerBox || '-',
    'Min Stock Level': product.minStockLevel,
    'Supplier': product.supplier || '-',
    'Supplier Code': product.supplier_code || '-',
    'Shopify SKUs': Object.keys(product.shopifySkus || {}).join(', ') || '-'
  }));
  const wsProducts = XLSX.utils.json_to_sheet(productsData);
  wsProducts['!cols'] = [
    { wch: 15 }, { wch: 15 }, { wch: 40 }, { wch: 20 }, { wch: 15 },
    { wch: 10 }, { wch: 15 }, { wch: 12 }, { wch: 8 }, { wch: 12 },
    { wch: 12 }, { wch: 15 }, { wch: 20 }, { wch: 15 }, { wch: 30 }
  ];
  XLSX.utils.book_append_sheet(wb, wsProducts, 'Products');

  // Transactions sheet
  const transactionsData = transactions.map(tx => ({
    'ID': tx.id,
    'Date': new Date(tx.created_at || tx.createdAt).toLocaleString(),
    'Product Code': tx.product_code || tx.productCode || '-',
    'Product Name': tx.product_name || tx.productName || '-',
    'Category': getCategoryLabel(tx.category),
    'Type': getTransactionTypeLabel(tx.type),
    'Quantity': tx.quantity,
    'Unit': tx.unit,
    'Balance After': tx.balance_after || tx.balanceAfter || '-',
    'Notes': tx.notes || '-',
    'Shopify Order': tx.shopify_order_id || tx.shopifyOrderId || '-'
  }));
  const wsTransactions = XLSX.utils.json_to_sheet(transactionsData);
  wsTransactions['!cols'] = [
    { wch: 12 }, { wch: 18 }, { wch: 15 }, { wch: 30 }, { wch: 20 },
    { wch: 18 }, { wch: 10 }, { wch: 8 }, { wch: 12 }, { wch: 40 }, { wch: 15 }
  ];
  XLSX.utils.book_append_sheet(wb, wsTransactions, 'Transactions');

  // SKU Mappings sheet
  const skuMappings = [];
  products.forEach(product => {
    if (product.shopifySkus && Object.keys(product.shopifySkus).length > 0) {
      Object.entries(product.shopifySkus).forEach(([variant, sku]) => {
        skuMappings.push({
          'Product Code': product.productCode,
          'Product Name': product.name,
          'Category': getCategoryLabel(product.category),
          'Variant': variant,
          'Shopify SKU': sku
        });
      });
    }
  });
  
  if (skuMappings.length > 0) {
    const wsSKU = XLSX.utils.json_to_sheet(skuMappings);
    wsSKU['!cols'] = [
      { wch: 15 }, { wch: 30 }, { wch: 20 }, { wch: 20 }, { wch: 20 }
    ];
    XLSX.utils.book_append_sheet(wb, wsSKU, 'SKU Mappings');
  }

  // Generate filename with timestamp
  const timestamp = new Date().toISOString().split('T')[0];
  const filename = `Full_Database_Export_${timestamp}.xlsx`;

  // Download file
  XLSX.writeFile(wb, filename);
}
