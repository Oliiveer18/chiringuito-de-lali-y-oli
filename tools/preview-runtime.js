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
    '<p class="muted" style="font-size:12px;margin-top:14px">Vista de pruebas: las partidas de esta vista se pierden al recargar. La versión de GitHub conserva su guardado normal.</p>');
})();
