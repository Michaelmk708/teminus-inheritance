/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    config.ignoreWarnings = [
      { module: /ox/ },
      { module: /virtualMasterPool/ },
    ];
    return config;
  },
};

export default nextConfig;