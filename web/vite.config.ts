import { defineConfig, PluginOption, UserConfig } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';
import preload from "vite-plugin-preload";
import { VitePWA } from 'vite-plugin-pwa';

import nodePolyfills from 'rollup-plugin-node-polyfills'; // for iconv-lite
// @TODO: remove iconv-lite and node polyfills in the future

export default defineConfig(({ command }): UserConfig => {
    const resolve = {
        alias: {
            // vite default polyfill not support string_decoder.StringDecoder by now
            // but iconv-lite require string_decoder.StringDecoder
            string_decoder:
                'rollup-plugin-node-polyfills/polyfills/string-decoder',
        }
    };
    const optimizeDeps = {
        esbuildOptions: {
            define: {
                global: 'globalThis'
            },
        }
    };
    const plugins: PluginOption[] = [
        react(),
        basicSsl(),
        nodePolyfills() as PluginOption,
    ];
    if (command === 'serve') {
        return {
            resolve,
            optimizeDeps,
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
            plugins,
        };
    }
    return {
        resolve,
        optimizeDeps,
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
            ...plugins,
            VitePWA({
                registerType: 'autoUpdate',
                workbox: {
                    globPatterns: ['**/*.{js,css,html,ico,png,svg}']
                }
            }),
            preload(),
        ],
    };
});
