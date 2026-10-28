const path = require("path");

module.exports = {
  style: {
    postcss: {
      mode: "file",
    },
  },
  webpack: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  eslint: {
    enable: false,
  },
  devServer: (devServerConfig) => {
    delete devServerConfig.onAfterSetupMiddleware;
    delete devServerConfig.onBeforeSetupMiddleware;
    if (devServerConfig.https) {
      devServerConfig.server = "https";
    }
    delete devServerConfig.https;
    return devServerConfig;
  },
};
