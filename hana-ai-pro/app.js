import { HANA_IMAGE_SRC } from './hana-image.js';

document.querySelectorAll('[data-hana]').forEach(img=>{img.src=HANA_IMAGE_SRC});

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
    img.className='avatar assistant-avatar';img.src=HANA_IMAGE_SRC;img.alt='Hana';img.width=38;img.height=38;return img;
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

document.getElementById('accountButton').addEventListener('click',()=>showToast('GARHY ID integration remains staged before public domain cutover.'));
document.getElementById('languageButton').addEventListener('click',()=>showToast('English localization is staged for the next release.'));
