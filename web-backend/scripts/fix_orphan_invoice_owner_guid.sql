-- Corrige invoices com owner_guid órfão (sem customer correspondente)
-- para o customer "Banco Inter" no book atual.
--
-- Ajuste os GUIDs se necessário antes de executar.
-- Execução sugerida:
--   psql "$DATABASE_URL" -f web-backend/scripts/fix_orphan_invoice_owner_guid.sql

BEGIN;

-- 1) Validação: customer destino deve existir.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM customers
    WHERE guid = '9c67aa83-1010-46ae-bdd1-38be7dc551de'
      AND book_id = 'ae221501-997a-4022-a8d3-bba1ad0e3c22'
  ) THEN
    RAISE EXCEPTION 'Customer destino (Banco Inter) não encontrado para o book esperado.';
  END IF;
END $$;

-- 2) Pré-visualização das invoices afetadas.
SELECT guid, id, owner_guid, date_opened, date_posted
FROM invoices
WHERE book_id = 'ae221501-997a-4022-a8d3-bba1ad0e3c22'
  AND owner_type = 'CUSTOMER'
  AND owner_guid IN (
    '33ee2b64-2c1c-47c6-8235-f5a2773a981a',
    '0c51e603-33ad-4d94-8f34-f4776d1c24bd'
  )
ORDER BY date_opened, id, guid;

-- 3) Remapeamento dos owner_guid órfãos para Banco Inter.
WITH remap(old_guid, new_guid) AS (
  VALUES
    ('33ee2b64-2c1c-47c6-8235-f5a2773a981a', '9c67aa83-1010-46ae-bdd1-38be7dc551de'),
    ('0c51e603-33ad-4d94-8f34-f4776d1c24bd', '9c67aa83-1010-46ae-bdd1-38be7dc551de')
)
UPDATE invoices i
SET owner_guid = r.new_guid,
    updated_at = NOW()
FROM remap r
WHERE i.owner_type = 'CUSTOMER'
  AND i.book_id = 'ae221501-997a-4022-a8d3-bba1ad0e3c22'
  AND i.owner_guid = r.old_guid;

-- 4) Conferência pós-update.
SELECT guid, id, owner_guid, date_opened, date_posted
FROM invoices
WHERE book_id = 'ae221501-997a-4022-a8d3-bba1ad0e3c22'
  AND owner_type = 'CUSTOMER'
  AND owner_guid = '9c67aa83-1010-46ae-bdd1-38be7dc551de'
  AND guid IN (
    '66419909-8d3c-4014-b442-0c1463e66c79',
    '101e554b-70ef-4ac7-b095-25dc6138f9e4',
    '29f96aa3-9f90-4acc-af6b-392d6508dfda'
  )
ORDER BY date_opened, id, guid;

COMMIT;

-- Se quiser apenas testar sem persistir, troque COMMIT por ROLLBACK.
