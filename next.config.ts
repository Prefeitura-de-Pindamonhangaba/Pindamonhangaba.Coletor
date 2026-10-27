import type { NextConfig } from "next";
const config: NextConfig = {
  poweredByHeader: false,
  serverExternalPackages: ["exceljs", "unzipper", "jszip"],
};
export default config;
