@echo off
chcp 65001 >nul
title Ghost's Roulette Server
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo [!] ยังไม่ได้ติดตั้ง Node.js - ดาวน์โหลดได้ที่ https://nodejs.org
  pause
  exit /b
)
if not exist node_modules (
  echo กำลังติดตั้งไฟล์ที่จำเป็นครั้งแรก...
  call npm install
)
start "" http://localhost:3000
echo ====================================================
echo  เซิร์ฟเวอร์เกมกำลังทำงาน - ห้ามปิดหน้าต่างนี้ระหว่างเล่น
echo ====================================================
node server.js
pause
