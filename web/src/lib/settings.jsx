import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { post, safeGet, safeSet } from './api.js';
import { t as translate } from './i18n.js';

const Ctx = createContext(null);

/** Language, role, shop and the "show model captions" toggle, remembered per device. */
export function SettingsProvider({ children }) {
  const [language, setLanguageState] = useState(() => safeGet('tm.lang') || null);
  const [role, setRole] = useState('public');
  const [shop, setShop] = useState(null);
  const [captions, setCaptionsState] = useState(() => safeGet('tm.captions') !== 'off');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    post('/device', language ? { language } : {})
      .then((d) => { setRole(d.role); setShop(d.shop); })
      .catch(() => {})
      .finally(() => setReady(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setLanguage = useCallback((l) => {
    setLanguageState(l);
    safeSet('tm.lang', l);
    post('/device', { language: l }).catch(() => {});
  }, []);

  const setCaptions = useCallback((on) => { setCaptionsState(on); safeSet('tm.captions', on ? 'on' : 'off'); }, []);
  const signIn = useCallback((r, s) => { setRole(r); setShop(s); }, []);

  const value = useMemo(() => ({
    language: language || 'en', hasLanguage: Boolean(language), setLanguage,
    role, shop, verified: role === 'pharmacist' || role === 'chemist' || role === 'admin', signIn,
    captions, setCaptions, ready,
    t: (key) => translate(language || 'en', key),
  }), [language, setLanguage, role, shop, signIn, captions, setCaptions, ready]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useSettings = () => useContext(Ctx);
