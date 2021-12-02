const path = require('path');
const nodeExternals = require('webpack-node-externals');
const TsconfigPathsPlugin = require('tsconfig-paths-webpack-plugin');

const {
  NODE_ENV = 'production',
} = process.env;

const config = {
  entry: path.join(__dirname, 'index.ts'),
  mode: NODE_ENV,
  target: 'node',
  devtool: undefined,
  module: {
    rules: [
      {
        test: /\.(ts|js)x?$/,
        use: 'ts-loader',
      },
    ],
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js', '.json'],
    plugins: [new TsconfigPathsPlugin()],
  },
  output: {
    filename: 'index.js',
    path: __dirname,
  },
  externals: [nodeExternals()],
}

module.exports = (env, argv) => {
  if (argv.mode === 'development') {
    config.mode = argv.mode;
    config.devtool = 'inline-source-map';
    config.output.filename = 'debug.js';
  }
  return config;
};
