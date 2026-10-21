// Page-local non-generative cleanup. Original photo and crop remain untouched.
function tuneDocument(c,settings={}){
 const ctx=c.getContext('2d'),im=ctx.getImageData(0,0,c.width,c.height),d=im.data;
 const ink=Math.max(0,Math.min(100,+settings.ink||0))/100,white=Math.max(0,Math.min(100,+settings.white||0))/100,yellow=Math.max(0,Math.min(100,+settings.yellow||0))/100,clean=Math.max(0,Math.min(100,+settings.clean||0))/100;
 for(let i=0;i<d.length;i+=4){let r=d[i],g=d[i+1],b=d[i+2];const hi=Math.max(r,g,b),lo=Math.min(r,g,b),lum=.299*r+.587*g+.114*b;
  // Saturated marks are excluded from neutral-paper/black-ink adjustments.
  const neutral=Math.max(0,1-(hi-lo)/65),paper=Math.max(0,Math.min(1,(lum-100)/100));
  const warm=Math.max(0,Math.min(1,(r-b-3)/45))*Math.max(0,1-(r-g)/75)*paper;
  b+=(Math.max(r,g)-b)*yellow*warm;r+=(Math.max(r,g)-r)*yellow*warm*.2;g+=(Math.max(r,g)-g)*yellow*warm*.2;
  const l=.299*r+.587*g+.114*b,light=Math.max(0,Math.min(1,(l-155)/65));
  // Fade pale, neutral artifacts, with a gradual transition to avoid hard edges.
  const fade=(1-(1-white*light)*(1-clean*light))*neutral;
  r+=(255-r)*fade;g+=(255-g)*fade;b+=(255-b)*fade;
  const dark=Math.max(0,Math.min(1,(180-l)/110))*neutral;
  const factor=1-.7*ink*dark;r*=factor;g*=factor;b*=factor;
  d[i]=r;d[i+1]=g;d[i+2]=b;
 }
 ctx.putImageData(im,0,0);return c;
}
let optState=null,optTimer;
function optSettings(){const v={};for(const id of ['ink','white','yellow','clean'])v[id]=+$('opt-'+id).value;return v}
function setOptSettings(v={}){for(const id of ['ink','white','yellow','clean']){$('opt-'+id).value=v[id]||0;$(id+'-value').textContent=v[id]||0}}
function rotateCanvas(c,turns){turns=((turns||0)%4+4)%4;if(!turns)return c;const out=canvas(turns%2?c.height:c.width,turns%2?c.width:c.height),ctx=out.getContext('2d');ctx.translate(out.width/2,out.height/2);ctx.rotate(turns*Math.PI/2);ctx.drawImage(c,-c.width/2,-c.height/2);return out}
function copyCanvas(c,max=Infinity){const s=Math.min(1,max/Math.max(c.width,c.height)),out=canvas(c.width*s,c.height*s);out.getContext('2d').drawImage(c,0,0,out.width,out.height);return out}
function optRender(){if(!optState)return;const original=$('opt-compare').dataset.original==='yes';const result=original?copyCanvas(optState.preview):tuneDocument(applyFilter(copyCanvas(optState.preview),$('opt-mode').value),optSettings());const out=$('opt-canvas');out.width=result.width;out.height=result.height;out.getContext('2d').drawImage(result,0,0);$('opt-compare').textContent=original?'返回优化预览':'查看原始裁剪';$('opt-compare').setAttribute('aria-pressed',String(original))}
function openOptimizer(page,index){if(working)return;try{const base=rotateCanvas(warp(page.source,page.corners,page.ratio),page.turns);optState={page,base,preview:copyCanvas(base,1100)};$('opt-title').textContent=`第 ${index+1} 页 · 页面优化`;$('opt-mode').value=page.filter||'original';setOptSettings(page.adjustments);$('opt-compare').dataset.original='no';$('optimizer').showModal();optRender()}catch(e){toast(e.message||'无法打开本页优化')}}
// Loaded before app.js; install handlers after the document and application initialize.
document.addEventListener('DOMContentLoaded',()=>{
 $('opt-close').onclick=()=>$('optimizer').close();
 $('optimizer').addEventListener('close',()=>{clearTimeout(optTimer);optState=null});
 for(const id of ['ink','white','yellow','clean'])$('opt-'+id).oninput=()=>{$(id+'-value').textContent=$('opt-'+id).value;$('opt-compare').dataset.original='no';clearTimeout(optTimer);optTimer=setTimeout(optRender,140)};
 $('opt-mode').onchange=()=>{$('opt-compare').dataset.original='no';optRender()};
 $('opt-compare').onclick=()=>{$('opt-compare').dataset.original=$('opt-compare').dataset.original==='yes'?'no':'yes';optRender()};
 $('opt-reset').onclick=()=>{$('opt-mode').value='original';setOptSettings();$('opt-compare').dataset.original='no';optRender()};
 $('opt-auto').onclick=()=>{$('opt-mode').value='enhance';setOptSettings({ink:35,white:45,yellow:70,clean:30});$('opt-compare').dataset.original='no';optRender()};
 $('opt-save').onclick=async()=>{if(!optState||working)return;const state=optState,mode=$('opt-mode').value,settings=optSettings(),btn=$('opt-save');working=true;btn.disabled=true;btn.textContent='正在优化…';$('opt-close').disabled=true;const preventCancel=e=>e.preventDefault();$('optimizer').addEventListener('cancel',preventCancel);await new Promise(r=>setTimeout(r,40));try{const result=tuneDocument(applyFilter(copyCanvas(state.base),mode),settings);state.page.result=result;state.page.filter=mode;state.page.adjustments=settings;state.page.preview=result.toDataURL('image/jpeg',.85);$('optimizer').close();toast('已保存本页优化，其他页面保持不变')}catch(e){toast(e.message||'优化失败，请降低处理强度重试')}finally{working=false;btn.disabled=false;btn.textContent='保存本页优化';$('opt-close').disabled=false;$('optimizer').removeEventListener('cancel',preventCancel);renderPages()}};
});
