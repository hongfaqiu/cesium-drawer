const config = {
  "presets": [
    "@babel/preset-env",
    "@babel/preset-typescript",
    "@babel/preset-react"
  ],
  "plugins": []
}

if (process.title === "webpack") {
  config.plugins.push("@babel/transform-runtime");
}

module.exports = config;