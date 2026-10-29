// Deliberately volatile: this file is included only in the sandbox preview build.
(() => {
  function memoryStore(){
    const values=new Map();
    return {
      getItem:key=>values.has(String(key))?values.get(String(key)):null,
      setItem:(key,value)=>{values.set(String(key),String(value));},
      removeItem:key=>{values.delete(String(key));},
      clear:()=>values.clear(),
      key:index=>[...values.keys()][index]??null,
      get length(){return values.size;}
    };
  }
  window.previewStorage=memoryStore();
  window.previewSessionStorage=memoryStore();
  document.querySelector('.title-card')?.insertAdjacentHTML('beforeend',
    '<p style="font-size:12px;line-height:1.45;margin:10px auto 0;max-width:480px;padding:10px 12px;border:1px solid #83bdbc;border-radius:8px;background:#06464b;color:#f5faf9">Vista de pruebas: el guardado de esta vista se pierde al recargar. Tu juego de GitHub conserva su guardado normal.</p>');
  const version=document.querySelector('#ver-title');
  if(version)version.style.color='#d6e8e7';
})();
