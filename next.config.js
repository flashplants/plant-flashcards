/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  async redirects() {
    return [
      {
        source: '/flashcards',
        destination: '/flashcards',
        permanent: true,
      },
      {
        source: '/dashboard',
        destination: '/dashboard',
        permanent: true,
      },
    ]
  },
}

module.exports = nextConfig