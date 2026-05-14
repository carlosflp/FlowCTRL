const backendOrigin = (process.env.FLOWCTRL_BACKEND_ORIGIN ?? "http://localhost:8000").replace(
  /\/$/,
  "",
);

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: `${backendOrigin}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
