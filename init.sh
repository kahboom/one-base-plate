#!/bin/bash
set -e

echo "Installing dependencies..."
npm install

echo "Running type check..."
npx tsc --noEmit

echo "Running tests..."
npm test

echo "Starting dev server..."
npm run dev
