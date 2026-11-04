'use client';

import { useEffect, useState } from 'react';

// Shown instead of a bare "500". Client component, so its few strings live here.
const TEXT = {
  en: { title: 'Something went wrong', lead: 'This page could not load just now. Please try again.', retry: 'Try again', home: 'Go to the home page' },
  sn: { title: 'Pane chakanganisika', lead: 'Peji iri harina kukwanisa kuvhurika izvozvi. Ndapota edzai zvakare.', retry: 'Edza zvakare', home: 'Enda kupeji rekutanga' },
  nd: { title: 'Kukhona okungahambanga kahle', lead: 'Leli khasi kalivulekanga khathesi. Sicela lizame futhi.', retry: 'Zama futhi', home: 'Iya ekhasini lokuqala' },
} as const;

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  const [lang, setLang] = useState<keyof typeof TEXT>('en');
  useEffect(() => {
    const m = document.cookie.match(/(?:^|; )vimba_locale=(en|sn|nd)/);
    if (m) setLang(m[1] as keyof typeof TEXT);
  }, []);
  const t = TEXT[lang];
  return (
    <div className="narrow">
      <h1>{t.title}</h1>
      <p className="lead">{t.lead}</p>
      <div className="actions">
        <button type="button" onClick={() => reset()}>{t.retry}</button>
        <a className="btn secondary" href="/">{t.home}</a>
      </div>
    </div>
  );
}
