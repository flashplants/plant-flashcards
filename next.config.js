/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  async rewrites() {
    return [
      {
        source: '/flashcards',
        destination: '/flashcards',
      },
      {
        source: '/dashboard',
        destination: '/dashboard',
      },
    ]
  },
  // Ensure proper handling of dynamic routes
  trailingSlash: false,
  // Enable strict mode for better error detection
  reactStrictMode: true,
  transpilePackages: ['lucide-react'],
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
}

module.exports = nextConfig