import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';

export default defineConfig(() => {
    return {
        server: {
            port: 3000,
            proxy: {
                '/upload': { target: 'https://localhost:7200', secure: false, changeOrigin: true },
                '/download': { target: 'https://localhost:7200', secure: false, changeOrigin: true },
                '/preview': { target: 'https://localhost:7200', secure: false, changeOrigin: true },
                '/rest': {
                    target: 'wss://localhost:7200',
                    ws: true,
                    secure: false,
                    changeOrigin: true,
                }
            },
        },
        build: {
            outDir: 'build',
        },
        plugins: [
            react(),
            basicSsl(),
        ],
    };
});
