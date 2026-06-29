module.exports = {
  apps: [
    {
      name: 'dar-dzayer-bot',
      script: 'index.js',
      watch: false,
      restart_delay: 5000,
      max_restarts: 10,
      env: {
        NODE_ENV: 'production',
      },
    },
    {
      name: 'dar-dzayer-dashboard',
      script: 'dashboard/server.js',
      watch: false,
      restart_delay: 3000,
      max_restarts: 10,
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
