const form=document.querySelector("#chat-form");
const input=document.querySelector("#user-input");
const send=document.querySelector("#send-button");
const messages=document.querySelector("#messages");
const scroll=document.querySelector("#scroll");
const statusEl=document.querySelector("#status");
let history=[],busy=false;
const esc=(value)=>String(value);
function scrollEnd(){scroll.scrollTop=scroll.scrollHeight}
function addMessage(role,content=""){
  const welcome=document.querySelector("#welcome");if(welcome)welcome.remove();
  const row=document.createElement("div");row.className="message "+role;
  const avatar=document.createElement("div");avatar.className="avatar";avatar.textContent=role==="user"?"أنت":"✦";
  const body=document.createElement("div");body.className="body";
  const label=document.createElement("div");label.className="role";label.textContent=role==="user"?"أنت":"NOVA AI";
  const text=document.createElement("div");text.className="text";text.textContent=content;
  body.append(label,text);row.append(avatar,body);messages.append(row);scrollEnd();return text;
}
function reset(){if(busy)return;history=[];messages.replaceChildren();const welcome=document.createElement("div");welcome.className="welcome";welcome.id="welcome";welcome.innerHTML='<div class="logo" style="font-size:30px">✦ NOVA AI</div><h1>كيف أقدر أساعدك اليوم؟</h1><p>اسأل، تعلّم، اكتب، أو خلّنا نسولف.</p>';messages.append(welcome);statusEl.textContent="محادثة جديدة";input.focus();}
document.querySelector("#new-chat").addEventListener("click",reset);
document.querySelector("#mobile-new").addEventListener("click",reset);
document.querySelectorAll("[data-prompt]").forEach(b=>b.addEventListener("click",()=>{input.value=b.dataset.prompt;sendMessage()}));
input.addEventListener("input",()=>{input.style.height="auto";input.style.height=Math.min(input.scrollHeight,180)+"px"});
input.addEventListener("keydown",e=>{if(e.key==="Enter"&&!e.shiftKey&&!e.isComposing){e.preventDefault();sendMessage()}});
form.addEventListener("submit",e=>{e.preventDefault();sendMessage()});
function collectEvents(chunk,process){const parts=chunk.split(/\r?\n\r?\n/);const rest=parts.pop()??"";for(const item of parts){const data=item.split(/\r?\n/).filter(l=>l.startsWith("data:")).map(l=>l.slice(5).trimStart()).join("\n");if(data)process(data);}return rest;}
async function sendMessage(){
  const prompt=input.value.trim();if(!prompt||busy)return;
  busy=true;send.disabled=true;input.disabled=true;
  input.value="";input.style.height="auto";addMessage("user",prompt);
  const previous=history.slice(-15);const next=[...previous,{role:"user",content:prompt}];
  const text=addMessage("assistant","جارٍ التفكير...");
  statusEl.textContent="NOVA AI يكتب الآن...";
  let result="",completed=false;
  try{
    const response=await fetch("/api/chat",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({messages:next})});
    if(!response.ok){let detail="تعذّر الاتصال بالخادم";try{const data=await response.json();detail=data.error||detail}catch{}throw Error(detail)}
    if(!response.body)throw Error("لم يصل رد من الخادم");
    const reader=response.body.getReader();const decoder=new TextDecoder();let buffer="";
    const handle=data=>{if(data==="[DONE]")return;try{const value=JSON.parse(data);const delta=typeof value.response==="string"?value.response:value.choices?.[0]?.delta?.content;if(typeof delta==="string"){result+=delta;text.textContent=result;scrollEnd()}}catch{}};
    while(true){const {done,value}=await reader.read();if(done)break;buffer=collectEvents(buffer+decoder.decode(value,{stream:true}),handle)}
    collectEvents(buffer+"\n\n",handle);
    if(!result.trim())throw Error("لم يرجع النموذج نصًا. جرّب مجددًا");
    history=[...next,{role:"assistant",content:result}].slice(-16);completed=true;
  }catch(err){text.textContent="حدث خطأ: "+(err.message||"حاول مرة أخرى");history=previous;}
  finally{busy=false;send.disabled=false;input.disabled=false;input.focus();statusEl.textContent=completed?"جاهز للمحادثة":"تعذّر إكمال الرد";}
}