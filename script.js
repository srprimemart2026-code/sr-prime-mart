(function(){
var $=function(i){return document.getElementById(i)};
var invTouched=false,orders=[],editId=null,ref=null,LS="srpm_orders_v1";
var LG={"পেন্ডিং":"Pending","পাঠানো হয়েছে":"Shipped","ডেলিভারি হয়েছে":"Delivered","ফেরত":"Returned","বাকি":"Due","আংশিক পরিশোধ":"Partial","পরিশোধিত":"Paid"};
function tk(n){return "৳"+Math.round(n||0).toLocaleString("en-US")}
function esc(s){var d=document.createElement("div");d.textContent=s==null?"":String(s);return d.innerHTML}
function today(){var d=new Date();return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0")}
function total(o){return (+o.price||0)*(+o.qty||0)-(+o.dc||0)}
function cls(v,t){return t=="d"?(v=="Delivered"?"g":v=="Returned"?"r":"o"):(v=="Paid"?"g":v=="Due"||v=="Loss"||v=="Scam"?"r":"o")}
function isL(o){return o.pst=="Loss"||o.pst=="Scam"}

function lsLoad(){try{return JSON.parse(localStorage.getItem(LS)||"[]")}catch(e){return[]}}
var idb=null;
function idbOpen(){return new Promise(function(res,rej){var r=indexedDB.open("srpm_db",1);r.onupgradeneeded=function(){r.result.createObjectStore("orders",{keyPath:"id"})};r.onsuccess=function(){res(r.result)};r.onerror=function(){rej(r.error)}})}
function idbAll(){return new Promise(function(res,rej){var q=idb.transaction("orders").objectStore("orders").getAll();q.onsuccess=function(){res(q.result)};q.onerror=function(){rej(q.error)}})}
function idbPut(o){return new Promise(function(res,rej){var t=idb.transaction("orders","readwrite");t.objectStore("orders").put(o);t.oncomplete=res;t.onerror=function(){rej(t.error)}})}
function idbDel(id){return new Promise(function(res,rej){var t=idb.transaction("orders","readwrite");t.objectStore("orders").delete(id);t.oncomplete=res;t.onerror=function(){rej(t.error)}})}
function lsSave(){try{localStorage.setItem(LS,JSON.stringify(orders))}catch(e){}}

async function init(){
  $("date").value=today();
  try{idb=await idbOpen();orders=await idbAll();if(!orders.length){var old=lsLoad();if(old.length){orders=old;for(var i=0;i<old.length;i++)await idbPut(old[i])}}try{navigator.storage&&navigator.storage.persist&&navigator.storage.persist()}catch(e){}}catch(e){idb=null;orders=lsLoad()}
  render();
  try{
    if(window.claude&&claude.use){
      var db=await claude.use("db"),user=await claude.use("user");
      if(db&&user){
        var id=await user.id();
        ref=db.collection("data/users/"+id);
        $("mode").textContent="Saved online";
        ref.onSnapshot(function(s){
          var a=s.docs.map(function(d){var x=d.data();x.id=d.id;return x});
          if(!a.length&&orders.length){orders.forEach(function(o){ref.doc(o.id).set(o).catch(function(){})});return}
          orders=a;render();
        },function(){ref=null;$("mode").textContent="Saved in this browser"});
        return;
      }
    }
  }catch(e){}
  $("mode").textContent="Saved in this browser (take regular CSV backups)";
}

function persist(o){
  if(ref){ref.doc(o.id).set(o).catch(function(){alert("Could not save, please try again")})}
  else{var i=orders.findIndex(function(x){return x.id==o.id});if(i>=0)orders[i]=o;else orders.push(o);if(idb)idbPut(o).catch(function(){alert("Could not save, please try again")});else lsSave();render()}
}
function remove(id){
  if(ref){ref.doc(id).delete().catch(function(){})}
  else{orders=orders.filter(function(x){return x.id!=id});if(idb)idbDel(id).catch(function(){});else lsSave();render()}
}

function pl(o){var a=total(o)-(+o.cost||0)*(+o.qty||0);if(o.pst=="Scam")return -Math.abs(a);if(o.pst=="Loss")return -(+o.dc||0);if(o.pst=="Paid")return a;return null}
function costCell(o){return o.cost==null?"—":tk((+o.cost||0)*(+o.qty||0))}
function plCell(o){var p=pl(o);if(p==null)return "—";if(o.dst=="Returned"&&!isL(o))return "<span class='mode'>returned</span>";return "<b class='"+(p>=0?"g":"r")+"'>"+(p>=0?"+":"−")+tk(Math.abs(p))+"</b>"}
function nextInv(){var m=0;orders.forEach(function(o){var x=/(\d+)\s*$/.exec(o.inv||"");if(x&&+x[1]>m)m=+x[1]});return "SRPM-"+String(m+1).padStart(4,"0")}
function fmt(b){return b<1048576?(b/1024).toFixed(1)+" KB":(b/1048576).toFixed(2)+" MB"}
function stor(){
  var el=$("stor");if(!el)return;
  var n=orders.length,sz=0;try{sz=new Blob([JSON.stringify(orders)]).size}catch(e){}
  if(ref){el.textContent="Storage: "+n+" orders · data size "+fmt(sz)+" · online storage limit is not shown by the platform"}
  else{var base="Storage: "+n+" orders · data "+fmt(sz);el.textContent=base;
    if(idb&&navigator.storage&&navigator.storage.estimate)navigator.storage.estimate().then(function(e){el.textContent=base+" · browser storage used "+fmt(e.usage||0)+" of "+fmt(e.quota||0)+" available"}).catch(function(){});
    else{var u=0;try{u=((localStorage.getItem(LS)||"").length+LS.length)*2}catch(e){}el.textContent=base+" · about "+fmt(u)+" of the 5 MB browser limit"}}
}
function render(){
  if(!editId&&!invTouched&&$("inv"))$("inv").value=nextInv();
  orders.forEach(function(o){o.dst=LG[o.dst]||o.dst;o.pst=LG[o.pst]||o.pst});
  var q=$("q").value.trim().toLowerCase(),fd=$("fd").value,fp=$("fp").value,ftp=$("ftp").value;
  var list=orders.slice().sort(function(a,b){return (b.date||"").localeCompare(a.date||"")||(b.ts||0)-(a.ts||0)});
  var f=list.filter(function(o){
    if(fd&&o.dst!=fd)return false;if(fp&&o.pst!=fp)return false;if(ftp=="Reseller"&&!o.rs)return false;if(ftp=="Own"&&o.rs)return false;
    if(!q)return true;
    return [o.inv,o.name,o.phone,o.product].join(" ").toLowerCase().indexOf(q)>-1;
  });
  $("tb").innerHTML=f.length?f.map(function(o){return "<tr><td>"+esc(o.inv||"—")+"</td><td>"+esc(o.date)+"</td><td>"+esc(o.name)+"</td><td>"+esc(o.phone)+"</td><td>"+esc(o.product)+"</td><td>"+(o.rs?"<span class='tag o'>Reseller</span>":"Own")+"</td><td>"+tk(o.price)+"</td><td>"+esc(o.qty)+"</td><td>"+tk(o.dc)+"</td><td><b>"+(o.pst=="Loss"?"—":tk(total(o)))+"</b></td><td>"+(o.pst=="Loss"?"—":costCell(o))+"</td><td>"+plCell(o)+"</td><td><span class='tag "+cls(o.dst,"d")+"'>"+esc(o.dst)+"</span></td><td><span class='tag "+cls(o.pst,"p")+"'>"+esc(o.pst)+"</span></td><td style='white-space:nowrap'><button class='s' data-e='"+esc(o.id)+"'>Edit</button> <button class='s d' data-x='"+esc(o.id)+"'>Delete</button></td></tr>"}).join(""):"<tr><td colspan='15' class='empty'>No orders yet</td></tr>";
  var ph={},sum=0,due=0,pend=0,pf=0,ls=0,dcs=0;
  orders.forEach(function(o){ph[o.phone||o.name]=1;var t=total(o);if(o.dst!="Returned"||isL(o))dcs+=(+o.dc||0);var pp=pl(o);if((o.dst!="Returned"||isL(o))&&pp!=null){if(isL(o))ls-=pp;else pf+=pp}if(o.dst!="Returned"){if(!isL(o))sum+=t;if(o.pst!="Paid"&&!isL(o))due+=t}if(o.dst=="Pending"||o.dst=="Shipped")pend++});
  $("sC").textContent=Object.keys(ph).length;$("sO").textContent=orders.length;$("sT").textContent=tk(sum);$("sD").textContent=tk(due);$("sP").textContent=pend;$("sDc").textContent=tk(dcs);
  $("sPf").textContent=tk(pf);$("sLs").textContent=tk(ls);var nt=pf-ls;$("sNt").textContent=(nt<0?"−":"")+tk(Math.abs(nt));$("sNt").className=nt<0?"r":"g";
  function dl(id,key){var s={};orders.forEach(function(o){if(o[key])s[o[key]]=1});$(id).innerHTML=Object.keys(s).map(function(v){return "<option value=\""+esc(v).replace(/"/g,"&quot;")+"\">"}).join("")}
  stor();dl("phones","phone");dl("names","name");dl("products","product");
}

function syncPst(){var r=$("rs").checked,v=$("pst").value;if(r&&v=="Loss")v="Scam";if(!r&&v=="Scam")v="Loss";if(["Due","Paid","Loss","Scam"].indexOf(v)<0)v="Due";$("pst").innerHTML="<option>Due</option><option>Paid</option><option>"+(r?"Scam":"Loss")+"</option>";$("pst").value=v}
function calcTot(){var q=+$("qty").value||0,dc=+$("dc").value||0,pr=(+$("price").value||0)*q,c=(+$("cost").value||0)*q,ps=$("pst").value,x="";if(ps=="Scam"){var sc=pr-c-dc;x="Scam loss: "+tk(Math.abs(sc))+"  (Price "+tk(pr)+" − Cost "+tk(c)+" − Delivery "+tk(dc)+")"}else if(ps=="Loss"){x=dc?"Loss: "+tk(dc)+" (delivery charge only)":""}else if(pr){x="Price "+tk(pr)+" − Cost "+tk(c)+" − Delivery "+tk(dc);if(ps=="Paid"){var p=pr-c-dc;x+=" = "+(p>=0?"Profit: ":"Loss: ")+tk(Math.abs(p))}else{x+=" · Profit counts after status is Paid"}}$("tot").textContent=x}

function autofill(by){
  var v=$(by).value.trim();if(!v)return;
  var m=orders.slice().sort(function(a,b){return (b.ts||0)-(a.ts||0)}).find(function(o){return o[by]==v});
  if(!m||editId)return;
  var other=by=="phone"?"name":"phone";
  if(!$(other).value)$(other).value=m[other]||"";
  var cnt=orders.filter(function(o){return o[by]==v}).length;
  var due=orders.filter(function(o){return o[by]==v&&o.pst!="Paid"&&!isL(o)&&o.dst!="Returned"}).reduce(function(s,o){return s+total(o)},0);
  $("hint").textContent="Returning customer · Previous orders: "+cnt+(due?" · Due: "+tk(due):"");
}

function clearForm(){
  editId=null;["phone","name","product","price","cost","dc"].forEach(function(i){$(i).value=""});
  $("qty").value=1;$("date").value=today();$("dst").selectedIndex=0;$("pst").selectedIndex=0;$("rs").checked=false;syncPst();
  invTouched=false;$("inv").value=nextInv();$("hint").textContent="";$("ft").textContent="Add new order";$("save").textContent="Save";calcTot();
}

$("phone").addEventListener("input",function(){autofill("phone")});
$("phone").addEventListener("change",function(){autofill("phone")});
$("name").addEventListener("change",function(){autofill("name")});
$("price").addEventListener("input",calcTot);$("qty").addEventListener("input",calcTot);$("dc").addEventListener("input",calcTot);$("cost").addEventListener("input",calcTot);$("pst").addEventListener("change",calcTot);$("rs").addEventListener("change",function(){syncPst();calcTot()});$("pst").addEventListener("change",calcTot);
["q","fd","fp","ftp"].forEach(function(i){$(i).addEventListener("input",render)});
$("clear").onclick=clearForm;$("inv").addEventListener("input",function(){invTouched=true});

$("save").onclick=function(){
  var name=$("name").value.trim(),phone=$("phone").value.trim();
  if(!name&&!phone){alert("Please enter a name or mobile number");return}
  var old=editId?orders.find(function(x){return x.id==editId}):null;
  var o={inv:$("inv").value.trim()||nextInv(),id:editId||("o"+Date.now().toString(36)+Math.random().toString(36).slice(2,6)),ts:old?old.ts:Date.now(),name:name,phone:phone,date:$("date").value||today(),product:$("product").value.trim(),price:+$("price").value||0,dc:+$("dc").value||0,cost:$("cost").value===""?null:(+$("cost").value||0),rs:$("rs").checked,qty:+$("qty").value||1,dst:$("dst").value,pst:$("pst").value};
  persist(o);clearForm();
  $("hint").textContent="Saved ✓";setTimeout(function(){if($("hint").textContent=="Saved ✓")$("hint").textContent=""},2500);
};

$("tb").addEventListener("click",function(e){
  var b=e.target.closest("button");if(!b)return;
  if(b.dataset.x){if(confirm("Delete this order?"))remove(b.dataset.x);return}
  if(b.dataset.e){
    var o=orders.find(function(x){return x.id==b.dataset.e});if(!o)return;
    editId=o.id;$("inv").value=o.inv||"";$("phone").value=o.phone||"";$("name").value=o.name||"";$("date").value=o.date||today();$("product").value=o.product||"";$("price").value=o.price||"";$("dc").value=o.dc||"";$("cost").value=o.cost==null?"":o.cost;$("rs").checked=!!o.rs;$("qty").value=o.qty||1;$("dst").value=o.dst;syncPst();$("pst").value=o.pst;
    $("ft").textContent="Editing order";$("save").textContent="Update";$("hint").textContent="";calcTot();
    window.scrollTo({top:0,behavior:"smooth"});
  }
});

$("csv").onclick=async function(){
  var h=["Invoice","Date","Name","Number","Product","Type","Price","Quantity","Delivery Charge","Total","Cost","Profit/Loss","Delivery","Payment"];
  var rows=[h].concat(orders.slice().sort(function(a,b){return (a.date||"").localeCompare(b.date||"")}).map(function(o){return [o.inv,o.date,o.name,o.phone,o.product,o.rs?"Reseller":"Own",o.price,o.qty,o.dc||0,total(o),o.cost==null?"":(+o.cost||0)*(+o.qty||0),pl(o)==null?"":pl(o),o.dst,o.pst]}));
  var csv="\ufeff"+rows.map(function(r){return r.map(function(c){return '"'+String(c==null?"":c).replace(/"/g,'""')+'"'}).join(",")}).join("\n");
  var tsv=rows.map(function(r){return r.map(function(c){return String(c==null?"":c).replace(/[\t\r\n]+/g," ")}).join("\t")}).join("\n");
  var m=$("csvmsg");m.textContent="";$("cp").style.display="none";
  var d=null;try{d=window.claude&&claude.use?await claude.use("downloads"):null}catch(e){}
  if(d){try{await d.save({filename:"sr-prime-mart-orders.csv",data:csv});m.textContent="File saved ✓";return}catch(e){if(e&&e.code=="declined"){m.textContent="Download cancelled";return}}}
  try{var a=document.createElement("a");a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv"}));a.download="sr-prime-mart-orders.csv";a.click()}catch(e){}
  $("cpt").value=tsv;$("cp").style.display="block";
};
$("cpc").onclick=function(){var t=$("cpt");t.select();var ok=false;try{ok=document.execCommand("copy")}catch(e){}$("csvmsg").textContent=ok?"Copied ✓ Now paste into Excel / Google Sheets":"Press Ctrl+C to copy the selected text"};
$("cpx").onclick=function(){$("cp").style.display="none"};

clearForm();init();
})();
