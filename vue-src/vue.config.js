module.exports = {
    devServer: {
      proxy: {
        '^/api': {
          target: 'http://localhost:3070',
          changeOrigin: true
        },
      }
    },
    configureWebpack: {
      devtool: 'source-map'
    }
  }