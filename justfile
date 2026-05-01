apm_cmd := "uvx --from 'git+https://github.com/microsoft/apm' apm"

mod website "website/mod.just"

# Install apm dependencies and regenerate .claude/ from .apm/ sources
apm:
    {{ apm_cmd }} install

# Run apm security audit
apm-audit:
    {{ apm_cmd }} audit

# Verify .claude/ stays in sync with .apm/ sources
apm-sync: apm apm-audit
    @if ! git diff --quiet; then \
        echo "ERROR: working tree has uncommitted changes after apm install"; \
        git diff --stat; \
        exit 1; \
    fi
