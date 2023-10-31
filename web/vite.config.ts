import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { terser } from 'rollup-plugin-terser';
import preload from "vite-plugin-preload";
import { InputPluginOption } from 'vite/node_modules/rollup';
import { VitePWA } from 'vite-plugin-pwa';

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
            outDir: "build",
            minify: "terser" as "terser",
            rollupOptions: {
                plugins: [
                    terser({
                        format: {
                            comments: false,
                            preserve_annotations: false,
                            ecma: 2015,
                        },
                        mangle: true,
                    }),
                ] as InputPluginOption,
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
