import { defineConfig, UserConfig } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';
import preload from "vite-plugin-preload";
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ command }): UserConfig => {
    if (command === 'serve') {
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
            plugins: [
                react(),
                basicSsl(),
            ],
        };
    }
    return {
        esbuild: {
            sourcemap: false,
            legalComments: "none",
            drop: ["console", "debugger"],
        },
        build: {
            outDir: "build",
            minify: "terser",
            terserOptions: {
                sourceMap: false,
                toplevel: true,
                ecma: 2015,
                parse: {
                    html5_comments: false,
                },
                compress: {
                    drop_console: true,
                    passes: 2,
                },
                format: {
                    comments: false,
                    preserve_annotations: false,
                },
                mangle: true,
            },
        },
        plugins: [
            react(),
            VitePWA({
                registerType: 'autoUpdate',
                workbox: {
                    globPatterns: ['**/*.{js,css,html,ico,png,svg}']
                }
            }),
            basicSsl(),
            preload(),
        ],
    };
});
