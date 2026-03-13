#!/bin/bash
# Pre-commit hooks (F100) enforce code quality (linting, formatting, type checking).
# Ralph focuses on implementation and testing. Hooks will block commits with issues.

claude --permission-mode acceptEdits "@PRD.json @agent-progress.md \
1. Read PRD.json and agent-progress.md. \
2. Find the next incomplete task (passes: false with satisfied dependencies). \
3. Implement it completely with tests. \
4. Update the feature's 'passes' field to true in PRD.json. \
5. Append to agent-progress.md with what you did, and the next task (if applicable). \
6. Commit your changes (pre-commit hooks will enforce quality automatically). \
7. EXIT IMMEDIATELY - do not process any additional tasks."
