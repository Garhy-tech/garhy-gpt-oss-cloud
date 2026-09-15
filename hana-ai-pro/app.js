const HANA_PRIMARY='/assets/identity/hana-primary.webp';
const HANA_GALLERY='/assets/identity/hana-gallery.webp';

document.querySelectorAll('[data-hana]').forEach(img=>{img.src=HANA_PRIMARY});

const hero=document.querySelector('.hero-card');
if(hero){
  const gallery=document.createElement('section');
  gallery.className='identity-gallery';
  gallery.setAttribute('aria-label','GARHY TECH approved identity collection');
  gallery.innerHTML=`<div class="identity-gallery-copy"><span class="eyebrow">OFFICIAL IDENTITY COLLECTION</span><strong>هوية GARHY TECH المعتمدة</strong></div><img src="${HANA_GALLERY}" alt="GARHY TECH approved identity avatar collection" width="510" height="207" loading="lazy" decoding="async">`;
  hero.insertAdjacentElement('afterend',gallery);
  const style=document.createElement('style');
  style.textContent='.identity-gallery{display:grid;grid-template-columns:minmax(180px,.42fr) minmax(0,1fr);align-items:center;gap:18px;margin:-2px 0 18px;padding:14px 16px;border:1px solid rgba(36,103,158,.32);border-radius:16px;background:linear-gradient(145deg,rgba(7,20,33,.9),rgba(3,11,20,.9));overflow:hidden}.identity-gallery-copy{display:grid;gap:6px}.identity-gallery-copy strong{font-size:14px}.identity-gallery img{display:block;width:100%;height:auto;max-height:207px;object-fit:contain;border-radius:12px;border:1px solid rgba(49,132,198,.24)}@media(max-width:820px){.identity-gallery{grid-template-columns:1fr}.identity-gallery-copy{text-align:center}.identity-gallery img{margin:auto}}';
  document.head.append(style);
}

const views=[...document.querySelectorAll('.view')];
const nav=[...document.querySelectorAll('[data-view]')];
const messages=document.getElementById('messages');
const form=document.getElementById('chatForm');
const input=document.getElementById('chatInput');
const toast=document.getElementById('toast');

function showToast(text){toast.textContent=text;toast.classList.add('show');setTimeout(()=>toast.classList.remove('show'),2600)}
function showView(name){views.forEach(v=>v.classList.toggle('active',v.id===`view-${name}`));nav.forEach(b=>b.classList.toggle('active',b.dataset.view===name));window.scrollTo({top:0,behavior:'smooth'})}
nav.forEach(button=>button.addEventListener('click',()=>showView(button.dataset.view)));

document.querySelectorAll('#quickGrid button').forEach(button=>button.addEventListener('click',()=>{input.value=button.textContent.trim();input.focus()}));

function createAvatar(role){
  if(role==='assistant'){
    const img=document.createElement('img');
    img.className='avatar assistant-avatar';img.src=HANA_PRIMARY;img.alt='Hana';img.width=38;img.height=38;return img;
  }
  const user=document.createElement('div');user.className='avatar user-avatar';user.textContent='U';user.setAttribute('aria-hidden','true');return user;
}

function addMessage(role,text){
  const article=document.createElement('article');article.className=`message ${role}`;
  const avatar=createAvatar(role);
  const bubble=document.createElement('div');bubble.className='bubble';
  const strong=document.createElement('strong');strong.textContent=role==='assistant'?'Hana':'You';
  const p=document.createElement('p');p.textContent=text;
  bubble.append(strong,p);article.append(avatar,bubble);messages.append(article);messages.scrollTop=messages.scrollHeight;
}

form.addEventListener('submit',async event=>{
  event.preventDefault();const text=input.value.trim();if(!text)return;
  addMessage('user',text);input.value='';
  const button=form.querySelector('button[type="submit"]');button.disabled=true;button.textContent='جاري التحليل...';
  try{
    const mode=document.getElementById('modeSelect').value;
    const response=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:'openai/gpt-oss-120b',reasoning:'high',messages:[{role:'system',content:`Professional mode: ${mode}. Be precise, engineering-focused and structured.`},{role:'user',content:text}]})});
    const payload=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(payload.error||'Hana AI backend is unavailable.');
    addMessage('assistant',payload.reply||'No response.');
  }catch(error){addMessage('assistant',`تعذر تنفيذ الطلب الآن: ${error.message}`)}
  finally{button.disabled=false;button.textContent='إرسال إلى Hana'}
});

document.getElementById('auditForm').addEventListener('submit',event=>{
  event.preventDefault();const url=document.getElementById('auditUrl').value.trim();const result=document.getElementById('auditResult');
  result.innerHTML='<img src="/assets/garhy-mark.webp" alt="" width="52" height="52"><div><strong>تم تجهيز الهدف فقط.</strong><p>Audit API غير مفعّل بعد، لذلك لن ندّعي تنفيذ فحص لم يحدث. الهدف المسجل: '+url.replace(/[<>&]/g,'')+'</p></div>';
  showToast('Audit target prepared — no scan executed.');
});

document.getElementById('accountButton').addEventListener('click',()=>showToast('GARHY ID integration remains staged.'));
document.getElementById('languageButton').addEventListener('click',()=>showToast('English localization is staged for the next release.'));
