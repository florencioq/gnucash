# Plano de CRUD - Contas, Commodities e Livros

Este documento descreve o plano completo de CRUD para os recursos principais da aplicação inspirada no GnuCash.

## 📋 Status Atual

### ✅ Já Implementado

#### 1. **Books (Livros)**
- ✅ `POST /books` - Criar livro
- ✅ `GET /books` - Listar todos os livros
- ✅ `GET /books/{id}` - Obter livro por ID

**Campos:**
- `id` (GUID, gerado automaticamente)
- `name` (opcional)
- `created_at` (timestamp automático)

**Funcionalidades:**
- Criação simples de livros
- Listagem completa
- Busca por ID

**Melhorias Sugeridas:**
- [ ] `PATCH /books/{id}` - Atualizar nome do livro
- [ ] `DELETE /books/{id}` - Deletar livro (com validação: só se não tiver contas)
- [ ] `GET /books/{id}/accounts` - Listar todas as contas de um livro
- [ ] Paginação na listagem
- [ ] Filtros de busca (por nome)

---

#### 2. **Commodities (Moedas/Commodities)**
- ✅ `POST /commodities` - Criar commodity
- ✅ `GET /commodities` - Listar commodities (com filtros: namespace, mnemonic)
- ✅ `GET /commodities/{id}` - Obter commodity por ID

**Campos:**
- `id` (GUID, gerado automaticamente)
- `namespace` (ex: "CURRENCY", "FUND", "STOCK")
- `mnemonic` (ex: "USD", "EUR", "AAPL")
- `fullname` (opcional, ex: "US Dollar")
- `fraction` (inteiro > 0, ex: 100 para centavos)
- `quote` (boolean, indica se tem cotação)

**Validações:**
- ✅ Unicidade: `(namespace, mnemonic)` deve ser único
- ✅ `fraction` deve ser > 0

**Funcionalidades:**
- Criação com validação de unicidade
- Listagem com filtros opcionais
- Busca por ID

**Melhorias Sugeridas:**
- [ ] `PATCH /commodities/{id}` - Atualizar commodity
- [ ] `DELETE /commodities/{id}` - Deletar commodity (com validação: só se não estiver em uso)
- [ ] `GET /commodities?namespace=CURRENCY` - Filtro por namespace (já existe, mas pode melhorar)
- [ ] Paginação na listagem
- [ ] Endpoint para listar commodities mais usadas
- [ ] Validação de mnemonic (uppercase, sem espaços)

---

#### 3. **Accounts (Contas)**
- ✅ `POST /accounts` - Criar conta
- ✅ `GET /accounts` - Listar contas (com filtros: book_id, parent_id, type, commodity_id)
- ✅ `GET /accounts/{id}` - Obter conta por ID
- ✅ `PATCH /accounts/{id}` - Atualizar conta
- ✅ `DELETE /accounts/{id}` - Deletar conta (só se não tiver filhos)
- ✅ `POST /accounts/{id}/move` - Mover conta para outro pai
- ✅ `GET /accounts/tree?book_id=...` - Obter árvore hierárquica de contas

**Campos:**
- `id` (GUID, gerado automaticamente)
- `book_id` (FK para books, obrigatório)
- `parent_id` (FK para accounts, opcional - cria hierarquia)
- `name` (obrigatório)
- `code` (opcional, ex: "100", "200")
- `description` (opcional)
- `type` (enum: ASSET, LIABILITY, INCOME, EXPENSE, EQUITY)
- `commodity_id` (FK para commodities, obrigatório)
- `is_placeholder` (boolean, indica se é conta container)
- `created_at`, `updated_at` (timestamps automáticos)

**Validações Implementadas:**
- ✅ `book_id` deve existir
- ✅ `commodity_id` deve existir
- ✅ `parent_id` deve existir e pertencer ao mesmo livro
- ✅ Nome deve ser único entre irmãos (mesmo `book_id` e `parent_id`)
- ✅ Prevenção de ciclos na hierarquia
- ✅ Não pode deletar conta com filhos

**Funcionalidades:**
- Criação com validações completas
- Listagem com múltiplos filtros
- Atualização parcial (PATCH)
- Movimentação na hierarquia com validações
- Visualização em árvore hierárquica
- Controle de profundidade na árvore (parâmetro `depth`)

**Melhorias Sugeridas:**
- [ ] `GET /accounts/{id}/children` - Listar apenas filhos diretos
- [ ] `GET /accounts/{id}/ancestors` - Obter caminho até a raiz
- [ ] `GET /accounts/{id}/descendants` - Obter todos os descendentes
- [ ] `POST /accounts/{id}/duplicate` - Duplicar conta (com ou sem filhos)
- [ ] Validação de compatibilidade de tipos (ex: ASSET não pode ter filho INCOME)
- [ ] Ordenação por `code` ou `name` na listagem
- [ ] Paginação na listagem
- [ ] Busca por nome (LIKE/ILIKE)
- [ ] `GET /accounts?book_id=X&type=ASSET` - Filtros combinados (já existe, mas pode melhorar)
- [ ] Endpoint para estatísticas de conta (número de filhos, profundidade, etc.)

---

## 🎯 Funcionalidades Adicionais Sugeridas

### 1. **Validações de Negócio**

#### Compatibilidade de Tipos de Conta
No GnuCash, certos tipos de conta só podem ter filhos de tipos compatíveis:
- ASSET, LIABILITY podem ter filhos ASSET, LIABILITY, BANK, CASH, etc.
- INCOME, EXPENSE podem ter filhos INCOME, EXPENSE
- EQUITY só pode ter filhos EQUITY

**Implementação sugerida:**
```python
# app/services/accounts.py
ACCOUNT_TYPE_COMPATIBILITY = {
    AccountType.ASSET: {AccountType.ASSET, AccountType.LIABILITY, ...},
    AccountType.INCOME: {AccountType.INCOME, AccountType.EXPENSE},
    AccountType.EQUITY: {AccountType.EQUITY},
    # ...
}

async def ensure_type_compatibility(session, parent_type, child_type):
    # Validar se child_type é compatível com parent_type
    ...
```

### 2. **Ordenação e Organização**

- Ordenação por `code` (código numérico)
- Ordenação por `name` (alfabética)
- Campo `sort_order` opcional para ordenação customizada
- Preservar ordem na árvore hierárquica

### 3. **Busca e Filtros Avançados**

- Busca textual por nome (LIKE/ILIKE)
- Busca por código parcial
- Filtros combinados (book + type + commodity)
- Busca em descrição

### 4. **Operações em Lote**

- `POST /accounts/batch` - Criar múltiplas contas
- `PATCH /accounts/batch` - Atualizar múltiplas contas
- `DELETE /accounts/batch` - Deletar múltiplas contas (com validações)

### 5. **Estatísticas e Relatórios**

- `GET /accounts/{id}/stats` - Estatísticas da conta
- `GET /books/{id}/stats` - Estatísticas do livro
- Contagem de contas por tipo
- Profundidade máxima da árvore
- Número de contas por nível

### 6. **Importação/Exportação**

- `POST /books/{id}/import` - Importar estrutura de contas (JSON/CSV)
- `GET /books/{id}/export` - Exportar estrutura de contas
- Compatibilidade com formato GnuCash XML (futuro)

---

## 📊 Estrutura de Dados Sugerida

### Melhorias no Modelo

#### Account
```python
# Campos adicionais sugeridos:
- sort_order: int | None  # Para ordenação customizada
- hidden: bool = False    # Para ocultar contas
- notes: str | None       # Notas adicionais
- tax_info: JSON | None   # Informações fiscais (futuro)
```

#### Book
```python
# Campos adicionais sugeridos:
- default_commodity_id: str | None  # Commodity padrão
- currency_format: str | None        # Formato de moeda
- date_format: str | None            # Formato de data
```

#### Commodity
```python
# Campos adicionais sugeridos:
- symbol: str | None      # Símbolo (ex: "$", "€")
- cusip: str | None       # CUSIP para ações
- isin: str | None        # ISIN para identificação
```

---

## 🔄 Fluxos de Trabalho Típicos

### 1. Criar um Novo Livro
```
1. POST /books → Criar livro
2. POST /commodities → Criar commodities necessárias (USD, EUR, etc.)
3. POST /accounts → Criar contas raiz (Assets, Liabilities, Income, Expenses, Equity)
4. POST /accounts → Criar sub-contas conforme necessário
```

### 2. Organizar Hierarquia de Contas
```
1. GET /accounts/tree?book_id=X → Ver estrutura atual
2. POST /accounts/{id}/move → Reorganizar contas
3. PATCH /accounts/{id} → Ajustar códigos e descrições
```

### 3. Gerenciar Commodities
```
1. GET /commodities?namespace=CURRENCY → Ver moedas disponíveis
2. POST /commodities → Adicionar nova moeda se necessário
3. GET /accounts?commodity_id=X → Ver contas usando a commodity
```

---

## 🧪 Testes Sugeridos

### Testes de Integração
- [ ] Criar livro completo com estrutura de contas
- [ ] Validar hierarquia complexa (múltiplos níveis)
- [ ] Testar movimentação de contas com muitos descendentes
- [ ] Validar exclusão em cascata (quando implementado)

### Testes de Validação
- [ ] Compatibilidade de tipos de conta
- [ ] Prevenção de ciclos em cenários complexos
- [ ] Unicidade de nomes em diferentes contextos
- [ ] Validação de commodities em uso

---

## 📝 Próximos Passos Recomendados

### Fase 1: Completar CRUD Básico (Prioridade Alta)
1. ✅ CRUD de Books (completar com PATCH e DELETE)
2. ✅ CRUD de Commodities (completar com PATCH e DELETE)
3. ✅ CRUD de Accounts (já completo, adicionar melhorias)

### Fase 2: Validações Avançadas (Prioridade Média)
1. Compatibilidade de tipos de conta
2. Validações de negócio adicionais
3. Melhorias em mensagens de erro

### Fase 3: Funcionalidades Extras (Prioridade Baixa)
1. Busca e filtros avançados
2. Estatísticas e relatórios
3. Operações em lote
4. Importação/Exportação

---

## 📚 Referências

- [GnuCash Account Types](https://wiki.gnucash.org/wiki/Account_Types)
- [GnuCash Data Model](https://wiki.gnucash.org/wiki/GnuCash_XML_format)
- Documentação atual: `web-backend/docs/plan-01.md`

---

## ✅ Checklist de Implementação

### Books
- [x] POST /books
- [x] GET /books
- [x] GET /books/{id}
- [ ] PATCH /books/{id}
- [ ] DELETE /books/{id}
- [ ] GET /books/{id}/accounts

### Commodities
- [x] POST /commodities
- [x] GET /commodities (com filtros)
- [x] GET /commodities/{id}
- [ ] PATCH /commodities/{id}
- [ ] DELETE /commodities/{id}

### Accounts
- [x] POST /accounts
- [x] GET /accounts (com filtros)
- [x] GET /accounts/{id}
- [x] PATCH /accounts/{id}
- [x] DELETE /accounts/{id}
- [x] POST /accounts/{id}/move
- [x] GET /accounts/tree
- [ ] GET /accounts/{id}/children
- [ ] GET /accounts/{id}/ancestors
- [ ] GET /accounts/{id}/descendants
