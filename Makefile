.PHONY: install test audit ci lint clean

# Install all dependencies (runtime + dev)
install:
	pip install -r requirements.txt -r requirements-dev.txt

# Run the test suite
test:
	pytest tests/ -v --cov=app --cov-report=term-missing

# Scan dependencies for known vulnerabilities (mirrors CI)
audit:
	pip-audit -r requirements.txt

# Run everything CI runs, locally — use this before pushing
ci: test audit

clean:
	rm -rf .pytest_cache htmlcov .coverage coverage.xml __pycache__
	find . -type d -name __pycache__ -exec rm -rf {} +
