-- ========================================================================
-- SCENT SYSTEM - SCHEMA UPDATE v4.0
-- ADD INCOMING ORDERS FEATURE
-- ========================================================================
-- Execute this in Neon SQL Editor BEFORE deploying new server
-- ========================================================================

-- Add incoming_orders column to products
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS incoming_orders JSONB DEFAULT '[]'::jsonb NOT NULL;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_products_incoming 
ON products USING gin(incoming_orders);

-- Add comment
COMMENT ON COLUMN products.incoming_orders IS 
'Array of incoming orders from Shopify: [{ orderNumber, sku, quantity, receivedAt }]';

-- Verify column was added
SELECT 
    column_name, 
    data_type, 
    column_default,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'products'
AND column_name = 'incoming_orders';

-- Test with sample data (optional)
-- UPDATE products SET incoming_orders = '[{"orderNumber":"#PO1234","sku":"SA_CA_00001","quantity":500,"receivedAt":"2026-02-14T12:00:00Z"}]'::jsonb
-- WHERE id = 'OIL_1';

-- Show result
SELECT id, name, incoming_orders 
FROM products 
LIMIT 5;

-- ========================================================================
-- VERIFICATION
-- ========================================================================
DO $$
DECLARE
    column_exists BOOLEAN;
    index_exists BOOLEAN;
BEGIN
    -- Check column
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'products' 
        AND column_name = 'incoming_orders'
    ) INTO column_exists;
    
    -- Check index
    SELECT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE indexname = 'idx_products_incoming'
    ) INTO index_exists;
    
    RAISE NOTICE '';
    RAISE NOTICE '═══════════════════════════════════════════════════';
    RAISE NOTICE 'SCHEMA UPDATE VERIFICATION';
    RAISE NOTICE '═══════════════════════════════════════════════════';
    RAISE NOTICE 'Column incoming_orders: %', 
        CASE WHEN column_exists THEN '✅ EXISTS' ELSE '❌ NOT FOUND' END;
    RAISE NOTICE 'Index idx_products_incoming: %',
        CASE WHEN index_exists THEN '✅ EXISTS' ELSE '❌ NOT FOUND' END;
    RAISE NOTICE '═══════════════════════════════════════════════════';
    
    IF column_exists AND index_exists THEN
        RAISE NOTICE '';
        RAISE NOTICE '✅ SCHEMA UPDATE SUCCESSFUL!';
        RAISE NOTICE '';
        RAISE NOTICE 'Next steps:';
        RAISE NOTICE '1. Deploy new server code (server-COMPLETE-v4.js)';
        RAISE NOTICE '2. Test incoming orders webhook';
        RAISE NOTICE '3. Update frontend to show Status column';
        RAISE NOTICE '';
    ELSE
        RAISE WARNING '⚠️ Schema update incomplete - check errors above';
    END IF;
END $$;

-- ========================================================================
-- SCRIPT COMPLETE
-- ========================================================================
