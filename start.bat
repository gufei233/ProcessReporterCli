@echo off
if not exist .env (
  echo [ERROR] .env not found! Copy .env.example to .env and fill in your config.
  echo.
  pause
  exit /b 1
)
node index.js
