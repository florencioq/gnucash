# 🚀 Como Iniciar o Servidor Backend

## Passo a Passo

### 1. Verificar se o Ambiente Virtual Está Ativo

```bash
cd web-backend
source .venv/bin/activate  # Linux/Mac
# ou
.venv\Scripts\activate  # Windows
```

Se não tiver o ambiente virtual, crie:
```bash
cd web-backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 2. Verificar se o Banco de Dados Está Rodando

```bash
# Na raiz do projeto
docker-compose ps
```

Se não estiver rodando:
```bash
docker-compose up -d
```

### 3. Verificar se as Migrações Foram Aplicadas

```bash
cd web-backend
alembic upgrade head
```

### 4. Iniciar o Servidor FastAPI

```bash
cd web-backend
uvicorn app.main:app --reload
```

Você deve ver algo como:
```
INFO:     Will watch for changes in these directories: ['/home/jose/projects/gnucash_cursor/web-backend']
INFO:     Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)
INFO:     Started reloader process
INFO:     Started server process
INFO:     Waiting for application startup.
INFO:     Application startup complete.
```

### 5. Verificar se o Servidor Está Respondendo

Abra outro terminal e teste:
```bash
curl http://localhost:8000/health
```

Deve retornar:
```json
{"status":"ok"}
```

## 🔧 Problemas Comuns

### Porta 8000 já está em uso

Se receber erro "Address already in use", use outra porta:

```bash
uvicorn app.main:app --reload --port 8001
```

E atualize o frontend em `web-frontend/src/services/api.ts`:
```typescript
baseURL: 'http://localhost:8001'
```

### Erro de conexão com o banco

Verifique:
1. Docker está rodando: `docker-compose ps`
2. Banco existe: `docker-compose exec postgres psql -U gnucash -d gnucash_web_cursor -c "\dt"`
3. DATABASE_URL está correto: `python3 check_database.py`

### Módulos não encontrados

Instale as dependências:
```bash
cd web-backend
source .venv/bin/activate
pip install -r requirements.txt
```

## ✅ Checklist

Antes de iniciar o servidor, verifique:

- [ ] Ambiente virtual está ativo
- [ ] Dependências instaladas (`pip install -r requirements.txt`)
- [ ] Docker está rodando (`docker-compose ps`)
- [ ] Banco de dados existe e tem as tabelas (`alembic upgrade head`)
- [ ] Porta 8000 está livre (ou use outra porta)

## 📝 Comandos Rápidos

```bash
# Tudo em um (se já tiver tudo configurado):
cd web-backend
source .venv/bin/activate
uvicorn app.main:app --reload
```
