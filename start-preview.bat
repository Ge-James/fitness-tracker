@echo off
cd /d "%~dp0"
echo Starting fitness tracker preview...
echo.
echo Open this address in Chrome:
echo http://127.0.0.1:5173/
echo.
echo Keep this window open while using the local preview.
echo Press Ctrl+C to stop.
echo.
"C:\Users\james\AppData\Local\Programs\Python\Python312\python.exe" -m http.server 5173 --bind 127.0.0.1
