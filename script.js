(function(){
var $=function(i){return document.getElementById(i)};
var invTouched=false,orders=[],editId=null,ref=null,LS="srpm_orders_v1";
var accounts=[],aEditId=null,LS_ACC="srpm_accounts_v1";
var stocks=[],stEditId=null,LS_STK="srpm_stocks_v1";
var LG={"পেন্ডিং":"Pending","পাঠানো হয়েছে":"Shipped","ডেলিভারি হয়েছে":"Delivered","ফেরত":"Returned","বাকি":"Due","আংশিক পরিশোধ":"Partial","পরিশোধিত":"Paid"};

function tk(n){return "৳"+Math.round(n||0).toLocaleString("en-US")}
function esc(s){var d=document.createElement("div");d.textContent=s==null?"":String(s);return d.innerHTML}
function today(){var d=new Date();return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0")}
function total(o){return (+o.price||0)*(+o.qty||0)-(+o.dc||0)}
function cls(v,t){return t=="d"?(v=="Delivered"?"g":v=="Returned"?"r":"o"):(v=="Paid"?"g":v=="Due"||v=="Loss"||v=="Scam"?"r":"o")}
function isL(o){return o.pst=="Loss"||o.pst=="Scam"}

/* ---------- TOP NAVIGATION TABS ---------- */
document.querySelectorAll(".tab-btn").forEach(function(btn){
  btn.addEventListener("click",function(){
    document.querySelectorAll(".tab-btn").forEach(function(b){b.classList.remove("active")});
    btn.classList.add("active");
    var t=btn.dataset.tab;
    document.querySelectorAll(".tab-sec").forEach(function(s){s.style.display="none"});
    $("sec-"+t).style.display="block";
    if(t==="accounts")renderAccounts();
    if(t==="customers")render();
    if(t==="stock")renderStock();
  });
});

/* ---------- STORAGE LAYER (IndexedDB + LocalStorage) ---------- */
function lsLoad(key){try{return JSON.parse(localStorage.getItem(key)||"[]")}catch(e){return[]}}
function lsSaveKey(key,arr){try{localStorage.setItem(key,JSON.stringify(arr))}catch(e){}}

var idb=null;
function idbOpen(){
  return new Promise(function(res,rej){
    var r=indexedDB.open("srpm_db",2);
    r.onupgradeneeded=function(){
      var db=r.result;
      if(!db.objectStoreNames.contains("orders"))db.createObjectStore("orders",{keyPath:"id"});
      if(!db.objectStoreNames.contains("accounts"))db.createObjectStore("accounts",{keyPath:"id"});
      if(!db.objectStoreNames.contains("stocks"))db.createObjectStore("stocks",{keyPath:"id"});
    };
    r.onsuccess=function(){res(r.result)};
    r.onerror=function(){rej(r.error)};
  });
}
function idbAllStore(store){
  return new Promise(function(res,rej){
    if(!idb||!idb.objectStoreNames.contains(store))return res([]);
    var q=idb.transaction(store).objectStore(store).getAll();
    q.onsuccess=function(){res(q.result)};
    q.onerror=function(){rej(q.error)};
  });
}
function idbPutStore(store,obj){
  return new Promise(function(res,rej){
    var t=idb.transaction(store,"readwrite");
    t.objectStore(store).put(obj);
    t.oncomplete=res;
    t.onerror=function(){rej(t.error)};
  });
}
function idbDelStore(store,id){
  return new Promise(function(res,rej){
    var t=idb.transaction(store,"readwrite");
    t.objectStore(store).delete(id);
    t.oncomplete=res;
    t.onerror=function(){rej(t.error)};
  });
}

async function init(){
  $("date").value=today();
  $("aDate").value=today();
  try{
    idb=await idbOpen();
    orders=await idbAllStore("orders");
    if(!orders.length){var old=lsLoad(LS);if(old.length){orders=old;for(var i=0;i<old.length;i++)await idbPutStore("orders",old[i])}}
    accounts=await idbAllStore("accounts");
    if(!accounts.length){var oldA=lsLoad(LS_ACC);if(oldA.length){accounts=oldA;for(var j=0;j<oldA.length;j++)await idbPutStore("accounts",oldA[j])}}
    stocks=await idbAllStore("stocks");
    if(!stocks.length){var oldS=lsLoad(LS_STK);if(oldS.length){stocks=oldS;for(var k=0;k<oldS.length;k++)await idbPutStore("stocks",oldS[k])}}
    try{navigator.storage&&navigator.storage.persist&&navigator.storage.persist()}catch(e){}
  }catch(e){
    idb=null;
    orders=lsLoad(LS);
    accounts=lsLoad(LS_ACC);
    stocks=lsLoad(LS_STK);
  }
  render();
  renderAccounts();
  renderStock();
  $("mode").textContent="Saved in this browser (take regular CSV backups)";
}

function persistOrder(o){
  var i=orders.findIndex(function(x){return x.id==o.id});
  if(i>=0)orders[i]=o;else orders.push(o);
  if(idb)idbPutStore("orders",o).catch(function(){alert("Could not save, please try again")});
  else lsSaveKey(LS,orders);
  render();renderAccounts();renderStock();
}
function removeOrder(id){
  orders=orders.filter(function(x){return x.id!=id});
  if(idb)idbDelStore("orders",id).catch(function(){});
  else lsSaveKey(LS,orders);
  render();renderAccounts();renderStock();
}

function persistAccount(a){
  var i=accounts.findIndex(function(x){return x.id==a.id});
  if(i>=0)accounts[i]=a;else accounts.push(a);
  if(idb)idbPutStore("accounts",a).catch(function(){alert("Could not save")});
  else lsSaveKey(LS_ACC,accounts);
  renderAccounts();
}
function removeAccount(id){
  accounts=accounts.filter(function(x){return x.id!=id});
  if(idb)idbDelStore("accounts",id).catch(function(){});
  else lsSaveKey(LS_ACC,accounts);
  renderAccounts();
}

function persistStock(s){
  var i=stocks.findIndex(function(x){return x.id==s.id});
  if(i>=0)stocks[i]=s;else stocks.push(s);
  if(idb)idbPutStore("stocks",s).catch(function(){alert("Could not save")});
  else lsSaveKey(LS_STK,stocks);
  renderStock();render();
}
function removeStock(id){
  stocks=stocks.filter(function(x){return x.id!=id});
  if(idb)idbDelStore("stocks",id).catch(function(){});
  else lsSaveKey(LS_STK,stocks);
  renderStock();render();
}

/* ---------- 2. CUSTOMER DATA LOGIC ---------- */
function pl(o){var a=total(o)-(+o.cost||0)*(+o.qty||0);if(o.pst=="Scam")return -Math.abs(a);if(o.pst=="Loss")return -(+o.dc||0);if(o.pst=="Paid")return a;return null}
function costCell(o){return o.cost==null?"—":tk((+o.cost||0)*(+o.qty||0))}
function plCell(o){var p=pl(o);if(p==null)return "—";if(o.dst=="Returned"&&!isL(o))return "<span class='mode'>returned</span>";return "<b class='"+(p>=0?"g":"r")+"'>"+(p>=0?"+":"−")+tk(Math.abs(p))+"</b>"}
function nextInv(){var m=0;orders.forEach(function(o){var x=/(\d+)\s*$/.exec(o.inv||"");if(x&&+x[1]>m)m=+x[1]});return "SRPM-"+String(m+1).padStart(4,"0")}
function fmt(b){return b<1048576?(b/1024).toFixed(1)+" KB":(b/1048576).toFixed(2)+" MB"}
function stor(){
  var el=$("stor");if(!el)return;
  var n=orders.length,sz=0;try{sz=new Blob([JSON.stringify({orders:orders,accounts:accounts,stocks:stocks})]).size}catch(e){}
  var base="Storage: "+n+" orders · "+stocks.length+" products · "+accounts.length+" entries · data "+fmt(sz);el.textContent=base;
  if(idb&&navigator.storage&&navigator.storage.estimate)navigator.storage.estimate().then(function(e){el.textContent=base+" · browser storage used "+fmt(e.usage||0)+" of "+fmt(e.quota||0)+" available"}).catch(function(){});
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
  function dl(id,key,extra){var s={};orders.forEach(function(o){if(o[key])s[o[key]]=1});if(extra)extra.forEach(function(x){if(x)s[x]=1});$(id).innerHTML=Object.keys(s).map(function(v){return "<option value=\""+esc(v).replace(/"/g,"&quot;")+"\">"}).join("")}
  stor();dl("phones","phone");dl("names","name");dl("products","product",stocks.map(function(x){return x.name}));
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

function fillProductFromStock(){
  var val=$("product").value.trim().toLowerCase();
  if(!val||editId)return;
  var st=stocks.find(function(s){return (s.name||"").trim().toLowerCase()===val});
  if(st){
    if(st.price)$("price").value=st.price;
    if(st.cost!=null)$("cost").value=st.cost;
    var avail=(+st.qty||0)-getSoldQty(st.name);
    $("hint").textContent="Stock available: "+avail+" units";
    calcTot();
  }
}
$("product").addEventListener("input",fillProductFromStock);
$("product").addEventListener("change",fillProductFromStock);

function clearForm(){
  editId=null;["phone","name","product","price","cost","dc"].forEach(function(i){$(i).value=""});
  $("qty").value=1;$("date").value=today();$("dst").selectedIndex=0;$("pst").selectedIndex=0;$("rs").checked=false;syncPst();
  invTouched=false;$("inv").value=nextInv();$("hint").textContent="";$("ft").textContent="Add new order";$("save").textContent="Save";calcTot();
}

$("phone").addEventListener("input",function(){autofill("phone")});
$("phone").addEventListener("change",function(){autofill("phone")});
$("name").addEventListener("change",function(){autofill("name")});
$("price").addEventListener("input",calcTot);$("qty").addEventListener("input",calcTot);$("dc").addEventListener("input",calcTot);$("cost").addEventListener("input",calcTot);$("pst").addEventListener("change",calcTot);$("rs").addEventListener("change",function(){syncPst();calcTot()});
["q","fd","fp","ftp"].forEach(function(i){$(i).addEventListener("input",render)});
$("clear").onclick=clearForm;$("inv").addEventListener("input",function(){invTouched=true});

$("save").onclick=function(){
  var name=$("name").value.trim(),phone=$("phone").value.trim();
  if(!name&&!phone){alert("Please enter a name or mobile number");return}
  var old=editId?orders.find(function(x){return x.id==editId}):null;
  var o={inv:$("inv").value.trim()||nextInv(),id:editId||("o"+Date.now().toString(36)+Math.random().toString(36).slice(2,6)),ts:old?old.ts:Date.now(),name:name,phone:phone,date:$("date").value||today(),product:$("product").value.trim(),price:+$("price").value||0,dc:+$("dc").value||0,cost:$("cost").value===""?null:(+$("cost").value||0),rs:$("rs").checked,qty:+$("qty").value||1,dst:$("dst").value,pst:$("pst").value};
  persistOrder(o);clearForm();
  $("hint").textContent="Saved ✓";setTimeout(function(){if($("hint").textContent=="Saved ✓")$("hint").textContent=""},2500);
};

$("tb").addEventListener("click",function(e){
  var b=e.target.closest("button");if(!b)return;
  if(b.dataset.x){if(confirm("Delete this order?"))removeOrder(b.dataset.x);return}
  if(b.dataset.e){
    var o=orders.find(function(x){return x.id==b.dataset.e});if(!o)return;
    editId=o.id;$("inv").value=o.inv||"";$("phone").value=o.phone||"";$("name").value=o.name||"";$("date").value=o.date||today();$("product").value=o.product||"";$("price").value=o.price||"";$("dc").value=o.dc||"";$("cost").value=o.cost==null?"":o.cost;$("rs").checked=!!o.rs;$("qty").value=o.qty||1;$("dst").value=o.dst;syncPst();$("pst").value=o.pst;
    $("ft").textContent="Editing order";$("save").textContent="Update";$("hint").textContent="";calcTot();
    window.scrollTo({top:0,behavior:"smooth"});
  }
});

$("csv").onclick=function(){
  var h=["Invoice","Date","Name","Number","Product","Type","Price","Quantity","Delivery Charge","Total","Cost","Profit/Loss","Delivery","Payment"];
  var rows=[h].concat(orders.slice().sort(function(a,b){return (a.date||"").localeCompare(b.date||"")}).map(function(o){return [o.inv,o.date,o.name,o.phone,o.product,o.rs?"Reseller":"Own",o.price,o.qty,o.dc||0,total(o),o.cost==null?"":(+o.cost||0)*(+o.qty||0),pl(o)==null?"":pl(o),o.dst,o.pst]}));
  downloadCSV(rows,"sr-prime-mart-orders.csv");
};

function downloadCSV(rows,filename){
  var csv="\ufeff"+rows.map(function(r){return r.map(function(c){return '"'+String(c==null?"":c).replace(/"/g,'""')+'"'}).join(",")}).join("\n");
  var tsv=rows.map(function(r){return r.map(function(c){return String(c==null?"":c).replace(/[\t\r\n]+/g," ")}).join("\t")}).join("\n");
  var m=$("csvmsg");if(m)m.textContent="";if($("cp"))$("cp").style.display="none";
  try{var a=document.createElement("a");a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv"}));a.download=filename;a.click()}catch(e){}
  if($("cpt")&&filename==="sr-prime-mart-orders.csv"){$("cpt").value=tsv;$("cp").style.display="block"}
}
$("cpc").onclick=function(){var t=$("cpt");t.select();var ok=false;try{ok=document.execCommand("copy")}catch(e){}$("csvmsg").textContent=ok?"Copied ✓ Now paste into Excel / Google Sheets":"Press Ctrl+C to copy the selected text"};
$("cpx").onclick=function(){$("cp").style.display="none"};

/* ---------- 1. ACCOUNTS LOGIC ---------- */
function renderAccounts(){
  var pf=0,ls=0;
  orders.forEach(function(o){
    var pp=pl(o);
    if((o.dst!="Returned"||isL(o))&&pp!=null){if(isL(o))ls-=pp;else pf+=pp}
  });
  var orderNet=pf-ls;
  var inc=0,exp=0;
  accounts.forEach(function(a){
    if(a.type==="Income")inc+=(+a.amt||0);
    else exp+=(+a.amt||0);
  });
  var bal=orderNet+inc-exp;
  $("aOrderNet").textContent=(orderNet<0?"−":"")+tk(Math.abs(orderNet));
  $("aOrderNet").className=orderNet<0?"r":"g";
  $("aInc").textContent=tk(inc);
  $("aExp").textContent=tk(exp);
  $("aBal").textContent=(bal<0?"−":"")+tk(Math.abs(bal));
  $("aBal").className=bal<0?"r":"g";
  $("aCnt").textContent=accounts.length;

  var q=$("aQ").value.trim().toLowerCase(),ft=$("aFt").value;
  var list=accounts.slice().sort(function(a,b){return (b.date||"").localeCompare(a.date||"")||(b.ts||0)-(a.ts||0)});
  var f=list.filter(function(a){
    if(ft&&a.type!==ft)return false;
    if(!q)return true;
    return [a.cat,a.note,a.date].join(" ").toLowerCase().indexOf(q)>-1;
  });
  $("aTb").innerHTML=f.length?f.map(function(a){
    var isInc=a.type==="Income";
    return "<tr><td>"+esc(a.date)+"</td><td><span class='tag "+(isInc?"g":"r")+"'>"+esc(a.type)+"</span></td><td><b>"+esc(a.cat)+"</b></td><td>"+esc(a.note||"—")+"</td><td><b class='"+(isInc?"g":"r")+"'>"+(isInc?"+":"−")+tk(a.amt)+"</b></td><td style='white-space:nowrap'><button class='s' data-ae='"+esc(a.id)+"'>Edit</button> <button class='s d' data-ax='"+esc(a.id)+"'>Delete</button></td></tr>";
  }).join(""):"<tr><td colspan='6' class='empty'>No account entries yet</td></tr>";
}

function clearAccountForm(){
  aEditId=null;$("aType").value="Expense";$("aDate").value=today();$("aCat").value="";$("aNote").value="";$("aAmt").value="";
  $("aft").textContent="Add income / expense";$("aSave").textContent="Save Entry";
}
$("aClear").onclick=clearAccountForm;
["aQ","aFt"].forEach(function(i){$(i).addEventListener("input",renderAccounts)});

$("aSave").onclick=function(){
  var cat=$("aCat").value.trim(),amt=+$("aAmt").value||0;
  if(!cat||amt<=0){alert("Please enter a category and valid amount");return}
  var old=aEditId?accounts.find(function(x){return x.id==aEditId}):null;
  var obj={id:aEditId||("a"+Date.now().toString(36)+Math.random().toString(36).slice(2,6)),ts:old?old.ts:Date.now(),type:$("aType").value,date:$("aDate").value||today(),cat:cat,note:$("aNote").value.trim(),amt:amt};
  persistAccount(obj);clearAccountForm();
  $("aHint").textContent="Entry saved ✓";setTimeout(function(){$("aHint").textContent=""},2500);
};

$("aTb").addEventListener("click",function(e){
  var b=e.target.closest("button");if(!b)return;
  if(b.dataset.ax){if(confirm("Delete this entry?"))removeAccount(b.dataset.ax);return}
  if(b.dataset.ae){
    var a=accounts.find(function(x){return x.id==b.dataset.ae});if(!a)return;
    aEditId=a.id;$("aType").value=a.type;$("aDate").value=a.date;$("aCat").value=a.cat;$("aNote").value=a.note||"";$("aAmt").value=a.amt;
    $("aft").textContent="Editing entry";$("aSave").textContent="Update";
    window.scrollTo({top:0,behavior:"smooth"});
  }
});

$("aCsv").onclick=function(){
  var rows=[["Date","Type","Category","Description","Amount"]].concat(accounts.map(function(a){return [a.date,a.type,a.cat,a.note,a.amt]}));
  downloadCSV(rows,"sr-prime-mart-accounts.csv");
};

/* ---------- 3. STOCK MANAGEMENT LOGIC ---------- */
function getSoldQty(productName){
  var p=(productName||"").trim().toLowerCase();
  if(!p)return 0;
  return orders.reduce(function(sum,o){
    if(!o.rs && o.dst!=="Returned" && (o.product||"").trim().toLowerCase()===p){
      return sum+(+o.qty||0);
    }
    return sum;
  },0);
}

function renderStock(){
  var totalUnits=0,lowCnt=0,costVal=0,sellVal=0;
  var computed=stocks.map(function(s){
    var sold=getSoldQty(s.name);
    var avail=(+s.qty||0)-sold;
    totalUnits+=Math.max(0,avail);
    if(avail<=5)lowCnt++;
    costVal+=Math.max(0,avail)*(+s.cost||0);
    sellVal+=Math.max(0,avail)*(+s.price||0);
    return Object.assign({},s,{sold:sold,avail:avail});
  });

  $("stTotal").textContent=stocks.length;
  $("stUnits").textContent=totalUnits;
  $("stLow").textContent=lowCnt;
  $("stCostVal").textContent=tk(costVal);
  $("stSellVal").textContent=tk(sellVal);

  var q=$("stQ").value.trim().toLowerCase(),flt=$("stFilter").value;
  var f=computed.filter(function(s){
    if(flt==="low"&&s.avail>5)return false;
    if(flt==="out"&&s.avail>0)return false;
    if(!q)return true;
    return [s.name,s.sku].join(" ").toLowerCase().indexOf(q)>-1;
  });

  $("stTb").innerHTML=f.length?f.map(function(s){
    var stBadge=s.avail<=0?"<span class='tag r'>Out of Stock</span>":(s.avail<=5?"<span class='tag o'>Low Stock</span>":"<span class='tag g'>In Stock</span>");
    return "<tr><td>"+esc(s.sku||"—")+"</td><td><b>"+esc(s.name)+"</b></td><td>"+tk(s.cost)+"</td><td>"+tk(s.price)+"</td><td>"+s.qty+"</td><td>"+s.sold+"</td><td><b class='"+(s.avail<=5?"r":"g")+"'>"+s.avail+"</b></td><td>"+tk(Math.max(0,s.avail)*(+s.cost||0))+"</td><td>"+stBadge+"</td><td style='white-space:nowrap'><button class='s' data-stplus='"+esc(s.id)+"'>+1</button> <button class='s' data-stminus='"+esc(s.id)+"'>−1</button></td><td style='white-space:nowrap'><button class='s' data-ste='"+esc(s.id)+"'>Edit</button> <button class='s d' data-stx='"+esc(s.id)+"'>Delete</button></td></tr>";
  }).join(""):"<tr><td colspan='11' class='empty'>No products in stock yet</td></tr>";
}

function clearStockForm(){
  stEditId=null;$("stName").value="";$("stSku").value="";$("stQty").value="0";$("stCost").value="";$("stPrice").value="";
  $("sft").textContent="Add / update product";$("stSave").textContent="Save Product";
}
$("stClear").onclick=clearStockForm;
["stQ","stFilter"].forEach(function(i){$(i).addEventListener("input",renderStock)});

$("stSave").onclick=function(){
  var name=$("stName").value.trim();
  if(!name){alert("Please enter product name");return}
  if(!stEditId){
    var dup=stocks.find(function(x){return (x.name||"").trim().toLowerCase()===name.toLowerCase()});
    if(dup){alert("This product already exists in Stock! Click Edit on that row to update its quantity.");return}
  }
  var old=stEditId?stocks.find(function(x){return x.id==stEditId}):null;
  var obj={id:stEditId||("s"+Date.now().toString(36)+Math.random().toString(36).slice(2,6)),ts:old?old.ts:Date.now(),name:name,sku:$("stSku").value.trim(),qty:+$("stQty").value||0,cost:+$("stCost").value||0,price:+$("stPrice").value||0};
  persistStock(obj);clearStockForm();
  $("stHint").textContent="Product saved ✓";setTimeout(function(){$("stHint").textContent=""},2500);
};

$("stTb").addEventListener("click",function(e){
  var b=e.target.closest("button");if(!b)return;
  if(b.dataset.stplus){
    var s=stocks.find(function(x){return x.id==b.dataset.stplus});
    if(s){s.qty=(+s.qty||0)+1;persistStock(s)}
    return;
  }
  if(b.dataset.stminus){
    var s=stocks.find(function(x){return x.id==b.dataset.stminus});
    if(s&&(+s.qty||0)>0){s.qty=(+s.qty||0)-1;persistStock(s)}
    return;
  }
  if(b.dataset.stx){if(confirm("Delete this product from stock?"))removeStock(b.dataset.stx);return}
  if(b.dataset.ste){
    var s=stocks.find(function(x){return x.id==b.dataset.ste});if(!s)return;
    stEditId=s.id;$("stName").value=s.name;$("stSku").value=s.sku||"";$("stQty").value=s.qty;$("stCost").value=s.cost;$("stPrice").value=s.price;
    $("sft").textContent="Editing product";$("stSave").textContent="Update";
    window.scrollTo({top:0,behavior:"smooth"});
  }
});

$("stCsv").onclick=function(){
  var rows=[["SKU","Product Name","Buying Cost","Selling Price","Total Added","Sold (Own)","Available Stock","Stock Value"]].concat(stocks.map(function(s){
    var sold=getSoldQty(s.name),avail=(+s.qty||0)-sold;
    return [s.sku,s.name,s.cost,s.price,s.qty,sold,avail,Math.max(0,avail)*(+s.cost||0)];
  }));
  downloadCSV(rows,"sr-prime-mart-stock.csv");
};

clearForm();init();
})();
