/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: {
    // Include data and references directories in the standalone output
    outputFileTracingIncludes: {
      '/api/chat': ['./data/**/*', './references/**/*'],
      '/api/knowledge/categories': ['./data/**/*', './references/**/*'],
      '/api/knowledge/resource/[code]': ['./data/**/*', './references/**/*'],
    },
  },
};

export default nextConfig;
