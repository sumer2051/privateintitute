import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const supabaseUrl =
    process.env.VITE_SUPABASE_URL ||
    env.VITE_SUPABASE_URL ||
    "https://fvrzpuxkehukgfjhjehh.supabase.co";
  const supabasePublishableKey =
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ2cnpwdXhrZWh1a2dmamhqZWhoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM4OTE4MzEsImV4cCI6MjA3OTQ2NzgzMX0.FrhNRmEFRFTKz4VX2h2A6-wYDbwaKZ7IT9rFXuQfams";
  const supabaseProjectId =
    process.env.VITE_SUPABASE_PROJECT_ID || env.VITE_SUPABASE_PROJECT_ID || "fvrzpuxkehukgfjhjehh";

  return {
    base: process.env.VITE_BASE_PATH || env.VITE_BASE_PATH || "/",
    define: {
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(supabaseUrl),
      "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(supabasePublishableKey),
      "import.meta.env.VITE_SUPABASE_PROJECT_ID": JSON.stringify(supabaseProjectId),
    },
    server: {
      host: "::",
      port: 8080,
    },
    plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
