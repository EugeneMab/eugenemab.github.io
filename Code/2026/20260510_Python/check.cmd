@echo off
echo Running Prettier...
call npx prettier --write src/**/*.ts

echo Running ESLint...
call npx eslint src/**/*.ts

echo Running Unit Tests with Coverage...
if not exist src\test_output mkdir src\test_output
cd src
call npm test > test_output\test.log 2>&1
type test_output\test.log
cd ..
