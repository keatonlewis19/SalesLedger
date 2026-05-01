#!/bin/bash
# Push current main branch to GitHub using stored PAT
cd /home/runner/workspace
git push "https://keatonlewis19:${GITHUB_PERSONAL_ACCESS_TOKEN}@github.com/keatonlewis19/SalesLedger.git" main --force
