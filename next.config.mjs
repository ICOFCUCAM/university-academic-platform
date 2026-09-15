/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // MOUNTED UNDER A PATH WHEN IT IS EMBEDDED. Standalone it serves from the
  // root; inside another university's site it can sit at /academic without a
  // code change. See INTEGRATION.md §2.
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || undefined,
};
export default nextConfig;
