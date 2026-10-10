import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Keep the API, auth, customer-specific quote pages, and the superseded
      // home page out of search.
      disallow: ["/api/", "/login", "/deck", "/deployments", "/legacy"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
