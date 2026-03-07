# IgeosCash - Operacao remota com Docker Context

Este projeto roda com `docker compose` local, mas os containers sobem no servidor remoto via `docker context` por SSH.

Modelo:
- Sua maquina: Docker CLI + codigo + `.env.prod`
- Servidor `cash.igeos.com.br`: daemon Docker + Nginx + SSL

## 1) Requisitos

### 1.1) Na sua maquina local

- Docker Engine
- Docker Compose plugin
- SSH com chave `~/.ssh/SSPDS.pem`

Instalacao rapida (Ubuntu):

```bash
sudo apt update
sudo apt install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker $USER
```

Depois de adicionar no grupo `docker`, reabra o terminal e valide:

```bash
docker version
docker compose version
```

### 1.2) No servidor `cash.igeos.com.br`

- Docker Engine + Compose plugin instalados
- Nginx instalado
- Certificado SSL (Lets Encrypt)
- DNS apontando para `cash.igeos.com.br`

## 2) Configurar SSH

Permissao da chave:

```bash
chmod 600 ~/.ssh/SSPDS.pem
```

`~/.ssh/config`:

```sshconfig
Host cash-igeos
  HostName cash.igeos.com.br
  User ubuntu
  IdentityFile ~/.ssh/SSPDS.pem
  IdentitiesOnly yes
```

Teste:

```bash
ssh cash-igeos 'hostname'
```

## 3) Criar o Docker Context remoto

```bash
docker context create cash --docker "host=ssh://cash-igeos"
docker context ls
```

Observacao:
- O contexto usa o Docker daemon do servidor.
- O `docker compose` le os arquivos locais e envia build/context para o host remoto.

## 4) Preparar variaveis de producao

Crie `.env.prod` na raiz do projeto:

```bash
cp .env.example .env.prod
```

Edite para producao:

```env
FRONTEND_PORT=5173
BACKEND_PORT=8000
POSTGRES_PORT=5433

POSTGRES_USER=gnucash
POSTGRES_PASSWORD=troque-por-senha-forte
POSTGRES_DB=gnucash_web
DATABASE_URL=postgresql+psycopg://gnucash:troque-por-senha-forte@db:5432/gnucash_web

VITE_API_BASE_URL=https://cash.igeos.com.br/api
CORS_ORIGINS=https://cash.igeos.com.br

AUTH_REQUIRED=true
AUTH_JWT_SECRET=troque-por-segredo-forte-min-32-bytes
AUTH_ACCESS_TOKEN_TTL_MINUTES=30
AUTH_REFRESH_TOKEN_TTL_MINUTES=10080
AUTH_PASSWORD_ITERATIONS=210000
SEED_ON_STARTUP=false
```

## 5) Deploy local e remoto (com exemplos)

Todos os comandos abaixo sao executados na sua maquina local, na raiz do projeto.

### 5.1) Deploy local (Docker local)

Modo manual:

```bash
docker compose --env-file .env.prod up -d --build
docker compose --env-file .env.prod ps
```

Modo script:

```bash
scripts/update-docker-stack.sh --env-file .env.prod
```

### 5.2) Deploy remoto (Docker Context `cash`)

Modo manual:

```bash
docker --context cash compose --env-file .env.prod up -d --build
docker --context cash compose --env-file .env.prod ps
```

Modo script:

```bash
scripts/update-docker-stack.sh --context cash --env-file .env.prod
```

Opcional (validar sem executar):

```bash
scripts/update-docker-stack.sh --context cash --env-file .env.prod --dry-run
```

### 5.3) Validacao de deploy remoto

```bash
docker --context cash compose --env-file .env.prod ps
curl -I https://cash.igeos.com.br
curl -I https://cash.igeos.com.br/api/health
```

## 6) Operacao diaria

Status:

```bash
docker --context cash compose --env-file .env.prod ps
```

Logs:

```bash
docker --context cash compose --env-file .env.prod logs -f web-backend
docker --context cash compose --env-file .env.prod logs -f web-frontend
docker --context cash compose --env-file .env.prod logs -f db
```

Rebuild/deploy:

```bash
docker --context cash compose --env-file .env.prod up -d --build
```

Reiniciar servico especifico:

```bash
docker --context cash compose --env-file .env.prod restart web-backend
```

Executar comando no container:

```bash
docker --context cash compose --env-file .env.prod exec db psql -U gnucash -d gnucash_web -c '\dt'
```

## 7) Backup e restore (via Docker Context)

Backup logico do banco remoto para arquivo local:

```bash
mkdir -p backups
docker --context cash compose --env-file .env.prod exec -T db sh -lc \
'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB"' \
> backups/gnucash_web_$(date +%Y%m%d_%H%M%S).sql
```

Restore de dump custom (`.dump`) local para banco remoto:

```bash
docker --context cash compose --env-file .env.prod stop web-backend

cat backups/SEU_ARQUIVO.dump | \
docker --context cash compose --env-file .env.prod exec -T db sh -lc \
'pg_restore -v --clean --if-exists --no-owner --no-privileges -U "$POSTGRES_USER" -d "$POSTGRES_DB"'

docker --context cash compose --env-file .env.prod up -d web-backend
```

## 8) Nginx no servidor (dominio unico)

Com DNS apenas em `cash.igeos.com.br`:
- Frontend em `/`
- API em `/api/`

Arquivo: `/etc/nginx/sites-available/cash.igeos.com.br`

```nginx
server {
    server_name cash.igeos.com.br;

    location = /api {
        return 301 /api/;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:8000/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_http_version 1.1;
        proxy_read_timeout 86400;
    }

    location / {
        proxy_pass http://127.0.0.1:5173/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 86400;
    }

    listen [::]:443 ssl; # managed by Certbot
    listen 443 ssl; # managed by Certbot
    ssl_certificate /etc/letsencrypt/live/cash.igeos.com.br/fullchain.pem; # managed by Certbot
    ssl_certificate_key /etc/letsencrypt/live/cash.igeos.com.br/privkey.pem; # managed by Certbot
    include /etc/letsencrypt/options-ssl-nginx.conf; # managed by Certbot
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem; # managed by Certbot
}

server {
    if ($host = cash.igeos.com.br) {
        return 301 https://$host$request_uri;
    } # managed by Certbot

    listen 80;
    listen [::]:80;
    server_name cash.igeos.com.br;
    return 404; # managed by Certbot
}
```

Ativar e recarregar:

```bash
sudo ln -sf /etc/nginx/sites-available/cash.igeos.com.br /etc/nginx/sites-enabled/cash.igeos.com.br
sudo nginx -t
sudo systemctl reload nginx
```

Lets Encrypt:

```bash
sudo certbot --nginx -d cash.igeos.com.br --redirect -m seu-email@dominio.com --agree-tos --no-eff-email
sudo certbot renew --dry-run
```

## 9) Troubleshooting rapido

`couldn't find env file .env.prod`:
- Crie o arquivo: `cp .env.example .env.prod`

`502 Bad Gateway`:
- Verifique containers: `docker --context cash compose --env-file .env.prod ps`
- Verifique Nginx ativo: `ssh cash-igeos 'sudo nginx -t && sudo systemctl status nginx --no-pager'`
- Verifique se o site `cash.igeos.com.br` esta habilitado em `/etc/nginx/sites-enabled`

Login falha mesmo com API online:
- Confirme `VITE_API_BASE_URL=https://cash.igeos.com.br/api` no `.env.prod`
- Rebuild frontend: `docker --context cash compose --env-file .env.prod up -d --build web-frontend`

## 10) Observacoes de producao

Melhorias recomendadas no `docker-compose.yml` para producao:
- nao expor porta do banco para internet
- bind de backend/frontend em localhost (`127.0.0.1`)
- volume do Postgres em `/var/lib/postgresql/data`

Se preferir, mantenha essas mudancas em um `docker-compose.prod.yml`.
