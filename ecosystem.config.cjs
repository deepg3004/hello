module.exports = {
  apps: [
    {
      name: 'hello-invoxai',
      script: 'server/index.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 8080,
      },
    },
  ],
}
