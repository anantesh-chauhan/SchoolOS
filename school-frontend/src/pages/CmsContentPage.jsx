import React from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar.jsx';
import Footer from '../components/Footer.jsx';
import Seo from '../components/Seo.jsx';
import PageHero from '../components/PageHero.jsx';
import apiClient from '../utils/apiClient.js';
import useSchoolStore from '../store/schoolStore.js';
import { schoolPath } from '../utils/schoolPath.js';

export const CmsContentPage = ({ slug, fallbackTitle }) => {
  const [page, setPage] = React.useState(null);
  const schoolSlug = useSchoolStore((state) => state.schoolSlug);

  React.useEffect(() => {
    apiClient.get(`/public/pages/${slug}`).then((res) => setPage(res.data.data)).catch(() => setPage(null));
  }, [slug]);

  if (!page) {
    return (
      <div>
        <Navbar />
        <PageHero title={fallbackTitle} subtitle="Content not published yet." />
        <section className="pb-14"><div className="section-shell"><Link className="brand-button" to={schoolPath('/admin/pages', schoolSlug)}>Publish this page from CMS</Link></div></section>
        <Footer />
      </div>
    );
  }

  return (
    <div>
      <Seo title={page.metaTitle || page.title} description={page.metaDescription || page.content || page.title} keywords={page.metaKeywords || []} />
      <Navbar />
      <PageHero title={page.headerData?.title || page.title} subtitle={page.headerData?.subtitle} />
      <section className="pb-14">
        <div className="section-shell">
          <article className="glass-panel p-6 text-[var(--color-muted)] text-sm whitespace-pre-wrap">
            {page.content}
          </article>
        </div>
      </section>
      <Footer />
    </div>
  );
};

export default CmsContentPage;
