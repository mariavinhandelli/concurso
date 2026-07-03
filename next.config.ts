import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        // Supabase Storage — avatares e uploads de usuários.
        protocol: 'https',
        hostname: 'krkbzeqwjrrxvdpwyqar.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
};

export default nextConfig;
