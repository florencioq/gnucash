#!/bin/bash

# Configurações
DEPLOY_ENV="igeoscash_stage"
DB_NAME="gnucash_web"
DB_USER="gnucash"
DB_PASSWORD="gnucash"
CONTAINER_NAME="gnucash-db-1"
AWS_S3_BUCKET="ideosbackups"
BACKUP_PATH="/tmp"

# Gerar nome de arquivo de backup
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE_NAME="${DEPLOY_ENV}_${DB_NAME}_${TIMESTAMP}.backup"

# 1. Criar um backup do banco de dados PostgreSQL que roda dentro de um Docker
docker exec -t $CONTAINER_NAME /bin/bash -c "pg_dump --create --if-exists --clean --format=c -U ${DB_USER} -f /tmp/${BACKUP_FILE_NAME} ${DB_NAME}"

# 2. Copiar o backup para fora do Docker
docker cp $CONTAINER_NAME:/tmp/${BACKUP_FILE_NAME} ${BACKUP_PATH}/${BACKUP_FILE_NAME}

# 3. Apagar o backup dentro do Docker
docker exec -t $CONTAINER_NAME /bin/bash -c "rm -f /tmp/${BACKUP_FILE_NAME}"

# 4. Copiar o backup para o Amazon S3
/usr/local/bin/aws s3 cp ${BACKUP_PATH}/${BACKUP_FILE_NAME} s3://${AWS_S3_BUCKET}/${BACKUP_FILE_NAME}

# 5. Apagar o backup da máquina
rm -f ${BACKUP_PATH}/${BACKUP_FILE_NAME}
