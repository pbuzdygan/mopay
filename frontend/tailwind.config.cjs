module.exports = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        panel: "var(--panel)",
        textPrim: "var(--text-prim)",
        textSec: "var(--text-sec)",
        accent: "var(--accent)",
        accentHover: "var(--accent-hover)",
        border: "var(--border)",
        rowHover: "var(--row-hover)",
        error: "var(--error)",
        success: "var(--success)"
      },
      boxShadow: {
        soft: "var(--shadow-soft)",
        float: "var(--shadow-float)"
      }
    }
  },
  plugins: []
};
