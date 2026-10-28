module.exports = {
  apps: [
    {
      name: "ipam-backend",
      cwd: "c:/Users/Administrator/Documents/IP_emergent/backend",
      script: "c:/Users/Administrator/Documents/IP_emergent/backend/.venv/Scripts/python.exe",
      args: "-m uvicorn server:app --host 0.0.0.0 --port 8001",
      interpreter: "none",
      autorestart: true,
      max_restarts: 10,
      restart_delay: 2000,
      env: {
        PYTHONUNBUFFERED: "1"
      }
    },
    {
      name: "ipam-frontend",
      cwd: "c:/Users/Administrator/Documents/IP_emergent/frontend",
      script: "c:/Users/Administrator/Documents/IP_emergent/frontend/node_modules/@craco/craco/dist/bin/craco.js",
      args: "start",
      autorestart: true,
      max_restarts: 10,
      restart_delay: 2000,
      env: {
        BROWSER: "none",
        PORT: 3000
      }
    }
  ]
};
