cd /d c:\005

taskkill /F /IM node.exe
taskkill /F /IM electron.exe

rmdir /s /q node_modules
del package-lock.json

npm cache clean --force
npm install --legacy-peer-deps --registry=https://registry.npmjs.org/