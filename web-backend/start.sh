#!/bin/bash
# Script para iniciar o servidor backend

set -e

echo "🚀 Iniciando servidor GnuCash Web Backend..."
echo ""

# Verificar se estamos no diretório correto
if [ ! -f "app/main.py" ]; then
    echo "❌ Erro: Execute este script do diretório web-backend"
    exit 1
fi

# Verificar ambiente virtual
if [ ! -d ".venv" ]; then
    echo "📦 Criando ambiente virtual..."
    python3 -m venv .venv
fi

# Ativar ambiente virtual
echo "🔧 Ativando ambiente virtual..."
source .venv/bin/activate

# Instalar dependências se necessário
if [ ! -f ".venv/.deps_installed" ]; then
    echo "📥 Instalando dependências..."
    pip install -r requirements.txt
    touch .venv/.deps_installed
fi

# Verificar Docker
echo "🐳 Verificando Docker..."
if ! docker-compose ps | grep -q "Up"; then
    echo "⚠️  Docker não está rodando. Iniciando..."
    cd ..
    docker-compose up -d
    cd web-backend
    sleep 2
fi

# Verificar migrações
echo "🗄️  Verificando migrações do banco de dados..."
alembic upgrade head

# Verificar configuração do banco
echo "🔍 Verificando configuração do banco..."
python3 check_database.py

echo ""
echo "✅ Tudo pronto! Iniciando servidor..."
echo "📍 Servidor estará disponível em: http://localhost:8000"
echo "📚 Documentação: http://localhost:8000/docs"
echo ""
echo "Pressione Ctrl+C para parar o servidor"
echo ""

# Iniciar servidor
uvicorn app.main:app --reload
