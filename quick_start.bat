@ECHO OFF

cd .\Game
start "Web Server" "nodemon" express.js
cd ..
cd .\Server
start "Game Server" "nodemon" server.js