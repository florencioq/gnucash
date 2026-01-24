# 🔧 Troubleshooting - Erro ao Salvar Livro

## Possíveis Causas e Soluções

### 1. ❌ Servidor Backend Não Está Rodando

**Sintoma:** Erro "Não foi possível conectar ao servidor"

**Solução:**
```bash
cd web-backend
uvicorn app.main:app --reload
```

Verifique se o servidor está rodando em `http://localhost:8000`

---

### 2. ❌ Banco de Dados Não Está Acessível

**Sintoma:** Erro de conexão com o banco de dados

**Solução:**
```bash
# Verificar se o Docker está rodando
docker-compose ps

# Se não estiver, iniciar
docker-compose up -d

# Verificar se o banco existe
docker-compose exec postgres psql -U gnucash -d gnucash_web_cursor -c "\dt"
```

---

### 3. ❌ Tabelas Não Foram Criadas

**Sintoma:** Erro ao inserir dados (tabela não existe)

**Solução:**
```bash
cd web-backend
alembic upgrade head
```

---

### 4. ❌ Porta do Backend Está Diferente

**Sintoma:** Erro de conexão, mas o servidor está rodando

**Verificar:**
- O backend está rodando em qual porta? (padrão: 8000)
- O frontend está configurado para a porta correta?

**Arquivo:** `web-frontend/src/services/api.ts`
```typescript
baseURL: 'http://localhost:8000'  // Ajustar se necessário
```

---

### 5. ❌ CORS Bloqueado

**Sintoma:** Erro no console do navegador sobre CORS

**Verificar:**
- O backend tem CORS habilitado? (`app/main.py`)
- A origem do frontend está na lista de origens permitidas?

---

### 6. 🔍 Como Diagnosticar

1. **Abra o Console do Navegador (F12)**
   - Veja se há erros detalhados
   - Verifique a aba Network para ver a requisição

2. **Verifique o Log do Backend**
   - Veja o terminal onde o uvicorn está rodando
   - Procure por mensagens de erro

3. **Teste a API Diretamente**
   ```bash
   curl -X POST http://localhost:8000/books \
     -H "Content-Type: application/json" \
     -d '{"name": "Test Book"}'
   ```

4. **Verifique a Conexão com o Banco**
   ```bash
   cd web-backend
   python3 check_database.py
   ```

---

## 📝 Mensagens de Erro Comuns

### "Erro ao salvar livro"
- **Causa:** Genérico - verifique o console do navegador para detalhes
- **Solução:** Use F12 para ver o erro completo

### "Network Error" ou "ECONNREFUSED"
- **Causa:** Backend não está rodando ou porta errada
- **Solução:** Inicie o backend e verifique a porta

### "Invalid book_id" ou erros de validação
- **Causa:** Dados inválidos sendo enviados
- **Solução:** Verifique o formato dos dados no formulário

### Erro 500 (Internal Server Error)
- **Causa:** Erro no servidor (banco, código, etc.)
- **Solução:** Verifique os logs do backend

---

## ✅ Checklist Rápido

- [ ] Backend está rodando? (`uvicorn app.main:app --reload`)
- [ ] Docker está rodando? (`docker-compose ps`)
- [ ] Banco de dados existe? (`alembic upgrade head`)
- [ ] Porta do backend está correta? (padrão: 8000)
- [ ] Console do navegador mostra erros? (F12)
- [ ] Logs do backend mostram erros?
