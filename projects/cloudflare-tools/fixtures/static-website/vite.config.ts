import cloudflare from "@oddlynew/distilled-cloudflare-vite-plugin";
import { defineConfig } from "vite";

const config = defineConfig({
  plugins: [cloudflare({})],
});

export default config;
