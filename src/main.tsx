import { createRoot } from "react-dom/client";
import "./index.css";

const rootEl = document.getElementById("root")!;

function renderFatal(message: string) {
  rootEl.innerHTML = `
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;font-family:Inter,system-ui,sans-serif;background:#0b1220;color:#fff;">
      <div style="max-width:520px;text-align:center;">
        <h1 style="font-size:22px;margin:0 0 12px;">BoA private institute</h1>
        <p style="opacity:.85;line-height:1.5;">${message}</p>
      </div>
    </div>`;
}

try {
  if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY) {
    renderFatal(
      "Missing backend configuration. Set <b>VITE_SUPABASE_URL</b> and <b>VITE_SUPABASE_PUBLISHABLE_KEY</b> in your hosting provider's environment variables, then redeploy."
    );
  } else {
    const { default: App } = await import("./App.tsx");
    createRoot(rootEl).render(<App />);
  }
} catch (err) {
  console.error(err);
  renderFatal("The app failed to start. Open the browser console for details.");
}

window.addEventListener("error", (e) => console.error("[global error]", e.error || e.message));
window.addEventListener("unhandledrejection", (e) => console.error("[unhandled rejection]", e.reason));
