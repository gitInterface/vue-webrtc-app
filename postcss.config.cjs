// postcss.config.cjs
module.exports = {
  plugins: [
    require('@tailwindcss/postcss')(), // ✅ 這是新版 Tailwind 需要的格式
    require('autoprefixer'),
  ]
}