# Migração para Adicionar Tipo ROOT

## ⚠️ Importante

Se você já tem um banco de dados criado, é necessário executar a migração para adicionar o tipo `ROOT` ao enum `accounttype`.

## Passos para Executar a Migração

1. Certifique-se de que o banco de dados está rodando:
   ```bash
   docker-compose up -d
   ```

2. Execute a migração do Alembic:
   ```bash
   cd web-backend
   alembic upgrade head
   ```

Isso irá:
- Adicionar `ROOT` ao enum `accounttype` no PostgreSQL
- Permitir criar contas do tipo ROOT

## Verificar se a Migração Foi Aplicada

Você pode verificar se o enum foi atualizado conectando ao banco:

```bash
docker-compose exec postgres psql -U gnucash -d gnucash_web_cursor -c "SELECT unnest(enum_range(NULL::accounttype));"
```

Deve mostrar todos os tipos, incluindo `ROOT`.

## Se a Migração Falhar

Se você receber um erro ao executar a migração, pode ser necessário:

1. Verificar se o banco está acessível
2. Verificar se a migração anterior foi aplicada:
   ```bash
   alembic current
   ```

3. Se necessário, aplicar manualmente:
   ```sql
   ALTER TYPE accounttype ADD VALUE IF NOT EXISTS 'ROOT';
   ```
