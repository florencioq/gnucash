# GnuCash Web Frontend

Aplicação React frontend para gerenciamento financeiro inspirada no GnuCash.

## 🚀 Tecnologias

- **React 18** com TypeScript
- **Vite** - Build tool rápida
- **React Router** - Roteamento
- **Axios** - Cliente HTTP
- **CSS Modules** - Estilização

## 📦 Instalação

```bash
cd web-frontend
npm install
```

## 🏃 Executar

```bash
npm run dev
```

A aplicação estará disponível em `http://localhost:5173`

## 🔧 Configuração

A aplicação está configurada para se conectar ao backend em `http://localhost:8000`.

Para alterar a URL do backend, edite `src/services/api.ts`:

```typescript
const api = axios.create({
  baseURL: 'http://localhost:8000',
  // ...
})
```

## 📁 Estrutura do Projeto

```
web-frontend/
├── src/
│   ├── components/       # Componentes reutilizáveis
│   │   ├── AccountModal.tsx
│   │   ├── AccountTree.tsx
│   │   ├── BookModal.tsx
│   │   └── CommodityModal.tsx
│   ├── pages/           # Páginas principais
│   │   ├── AccountsPage.tsx
│   │   ├── BooksPage.tsx
│   │   └── CommoditiesPage.tsx
│   ├── services/        # Serviços de API
│   │   ├── api.ts
│   │   ├── accounts.ts
│   │   ├── books.ts
│   │   └── commodities.ts
│   ├── App.tsx          # Componente principal
│   ├── App.css          # Estilos globais
│   ├── main.tsx         # Entry point
│   └── index.css        # Reset CSS
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## ✨ Funcionalidades

### 📚 Livros (Books)
- Listar livros
- Criar novo livro
- Editar livro (quando backend implementar PATCH)

### 💱 Commodities
- Listar commodities
- Filtrar por namespace
- Criar nova commodity
- Editar commodity (quando backend implementar PATCH)

### 📊 Contas (Accounts)
- Visualização em lista
- Visualização em árvore hierárquica
- Criar conta
- Editar conta
- Deletar conta
- Filtrar por livro
- Suporte a hierarquia de contas

## 🎨 Interface

A interface foi projetada com:
- Design moderno e limpo
- Cores inspiradas no GnuCash
- Responsivo
- Feedback visual para ações
- Modais para formulários
- Visualização em árvore para contas

## 🔗 Integração com Backend

A aplicação consome a API REST do backend:

- `GET /books` - Listar livros
- `POST /books` - Criar livro
- `GET /commodities` - Listar commodities
- `POST /commodities` - Criar commodity
- `GET /accounts` - Listar contas
- `GET /accounts/tree` - Árvore de contas
- `POST /accounts` - Criar conta
- `PATCH /accounts/{id}` - Atualizar conta
- `DELETE /accounts/{id}` - Deletar conta

## 📝 Próximos Passos

- [ ] Implementar paginação
- [ ] Adicionar busca/filtros avançados
- [ ] Implementar drag-and-drop para mover contas
- [ ] Adicionar validações de formulário mais robustas
- [ ] Implementar tratamento de erros mais detalhado
- [ ] Adicionar loading states
- [ ] Implementar cache de dados
- [ ] Adicionar testes unitários
