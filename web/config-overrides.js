module.exports = function override(config, env) {
    config.module.rules.splice(0, 0, {
        test: /\.worker\.js$/,
        use: { loader: 'worker-loader' }
    })
    return config;
}