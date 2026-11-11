export const go = (to: string) => { history.pushState(null, '', to); dispatchEvent(new PopStateEvent('popstate')); scrollTo({ top: 0, behavior: 'instant' }); };
