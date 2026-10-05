'use strict';
(() => {
 const panel=document.querySelector('#bpl-install'),button=document.querySelector('#bpl-install-button'),guide=document.querySelector('#bpl-install-guide');
 const standalone=window.matchMedia('(display-mode: standalone)');
 const hideInstalled=()=>{panel.hidden=standalone.matches||navigator.standalone===true};
 hideInstalled();standalone.addEventListener('change',hideInstalled);
 const ios=/iPhone|iPad|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
 if(!ios)guide.textContent='ブラウザのメニューから「ホーム画面に追加」または「アプリをインストール」を選んでください。';
 let installPrompt=null;
 window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event;button.hidden=false});
 button.addEventListener('click',async()=>{if(!installPrompt)return;try{await installPrompt.prompt();const result=await installPrompt.userChoice;if(result.outcome==='accepted')panel.hidden=true}catch{guide.textContent='ブラウザのメニューから追加してください。'}finally{installPrompt=null;button.hidden=true}});
 window.addEventListener('appinstalled',()=>{panel.hidden=true;installPrompt=null});
})();
