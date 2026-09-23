(()=>{
  try {
    const root=document.documentElement;
    const theme=localStorage.getItem('gt-bybit-theme')==='light'?'light':'dark';
    const language=localStorage.getItem('gt-bybit-language')==='en'?'en':'ar';
    root.dataset.theme=theme;
    root.dataset.lang=language;
    root.lang=language;
    root.dir=language==='ar'?'rtl':'ltr';
    root.style.colorScheme=theme;
  } catch {}
})();
