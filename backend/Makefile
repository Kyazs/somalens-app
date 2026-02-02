.PHONY: dev prod migrate migrate-create shell logs stop clean redis-cli celery-logs help

# Development
dev:
	docker-compose -f docker/docker-compose.dev.yml up

# Production
prod:
	docker-compose -f docker/docker-compose.prod.yml up -d

# Database migrations
migrate:
	docker-compose -f docker/docker-compose.dev.yml exec api alembic upgrade head

migrate-create:
	@read -p "Migration name: " name; \
	docker-compose -f docker/docker-compose.dev.yml exec api alembic revision --autogenerate -m "$$name"

# Docker utilities
shell:
	docker-compose -f docker/docker-compose.dev.yml exec api bash

logs:
	docker-compose -f docker/docker-compose.dev.yml logs -f api

celery-logs:
	docker-compose -f docker/docker-compose.dev.yml logs -f worker

redis-cli:
	docker-compose -f docker/docker-compose.dev.yml exec redis redis-cli

stop:
	docker-compose -f docker/docker-compose.dev.yml down

clean:
	docker-compose -f docker/docker-compose.dev.yml down -v
	rm -rf data/

help:
	@echo "Available commands:"
	@echo "  make dev           - Start development environment"
	@echo "  make prod          - Start production environment"
	@echo "  make migrate       - Run database migrations"
	@echo "  make migrate-create - Create new migration"
	@echo "  make shell         - Enter API container shell"
	@echo "  make logs          - View API logs"
	@echo "  make celery-logs   - View Celery worker logs"
	@echo "  make redis-cli     - Enter Redis CLI"
	@echo "  make stop          - Stop containers"
	@echo "  make clean         - Remove containers and data"
