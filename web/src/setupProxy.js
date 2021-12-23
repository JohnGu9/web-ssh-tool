const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function (app) {
  app
    .use(createProxyMiddleware('/upload', {
      target: 'https://localhost:7200',
      changeOrigin: true,
      secure: false,
      logLevel: 'silent',
    }))
    .use(createProxyMiddleware('/download', {
      target: 'https://localhost:7200',
      changeOrigin: true,
      secure: false,
      logLevel: 'silent',
    }))
    .use(createProxyMiddleware('/rest', {
      target: 'wss://localhost:7200',
      changeOrigin: true,
      secure: false,
      ws: true,
      logLevel: 'silent',
    }))
    .use(createProxyMiddleware('/watch', {
      target: 'wss://localhost:7200',
      changeOrigin: true,
      secure: false,
      ws: true,
      logLevel: 'silent',
    }));
};