import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // tesseract.js is still used for local OCR fallback in the PYQ route.
  // pdf-parse and mammoth are no longer used — parsing moved to Python backend.
  serverExternalPackages: ["tesseract.js"],

  // Required for Docker multi-stage builds (copies only what's needed into the image).
  output: "standalone",

  // Expose the FastAPI backend URL to both server and client components.
  env: {
    NEXT_PUBLIC_BACKEND_URL: process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000",
    BACKEND_URL: process.env.BACKEND_URL || "http://localhost:8000",
  },
};

export default nextConfig;
