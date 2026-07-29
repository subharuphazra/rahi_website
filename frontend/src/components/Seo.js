import React, { useEffect } from "react";
import { Helmet } from "react-helmet-async";

const SITE_URL = process.env.REACT_APP_BACKEND_URL || "";

export function SiteMeta({ title, description, image, url }) {
  const fullTitle = title ? `${title} · Rahi Bangla` : "Rahi Bangla — India's Story, Told Twice";
  const desc =
    description ||
    "Independent bilingual coverage of India: business, elections, sports, entertainment, science, education and lifestyle.";
  const img = image || "https://images.pexels.com/photos/35743103/pexels-photo-35743103.jpeg";
  const canonical = url || (typeof window !== "undefined" ? window.location.href : SITE_URL);

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={desc} />
      <link rel="canonical" href={canonical} />
      <meta property="og:site_name" content="Rahi Bangla" />
      <meta property="og:type" content="website" />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={desc} />
      <meta property="og:image" content={img} />
      <meta property="og:url" content={canonical} />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={desc} />
      <meta name="twitter:image" content={img} />
      <link rel="alternate" type="application/rss+xml" title="Rahi Bangla RSS" href={`${SITE_URL}/api/rss.xml`} />
    </Helmet>
  );
}

export function ArticleJsonLd({ article, canonical }) {
  if (!article) return null;
  const title = article.title_en || article.title_bn;
  const image = article.image_url ||
    (article.image_path ? `${SITE_URL}/api/files/${article.image_path}` : undefined);
  const ld = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: title,
    description: article.excerpt_en || article.excerpt_bn,
    image: image ? [image] : undefined,
    datePublished: article.created_at,
    dateModified: article.updated_at || article.created_at,
    articleSection: article.category,
    author: {
      "@type": "Person",
      name: article.author_name,
    },
    publisher: {
      "@type": "Organization",
      name: "Rahi Bangla",
    },
    mainEntityOfPage: canonical,
  };
  return (
    <Helmet>
      <script type="application/ld+json">{JSON.stringify(ld)}</script>
    </Helmet>
  );
}
