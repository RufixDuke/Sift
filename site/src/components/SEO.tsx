import React from 'react';
import { Helmet } from 'react-helmet-async';

interface SEOProps {
  title?: string;
  description?: string;
}

export function SEO({ title, description }: SEOProps): React.ReactElement {
  const fullTitle = title ? `${title} — Sift` : 'Sift — Intelligent Log Aggregator for Local Development';
  const desc =
    description ||
    'Sift aggregates, parses, and filters logs from all your local services in one beautiful terminal interface.';

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={desc} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={desc} />
      <meta name="twitter:card" content="summary_large_image" />
    </Helmet>
  );
}
