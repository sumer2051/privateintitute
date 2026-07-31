import { Helmet } from "react-helmet-async";

const SITE = "https://privateintitute.lovable.app";

interface SeoProps {
  title: string;
  description: string;
  path: string;
  noindex?: boolean;
}

/** Per-route title, description, canonical and social tags. */
export const Seo = ({ title, description, path, noindex }: SeoProps) => {
  const url = `${SITE}${path}`;
  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:type" content="website" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      {noindex ? <meta name="robots" content="noindex, nofollow" /> : null}
    </Helmet>
  );
};
