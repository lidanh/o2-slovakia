import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin();

const config: NextConfig = {
  transpilePackages: ["@repo/shared"],
};

export default withNextIntl(config);
