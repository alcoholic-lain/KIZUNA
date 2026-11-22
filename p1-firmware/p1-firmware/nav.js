/* Shared top bar: same on every demo page. Served by gateway (:8123) and STEG server (:9200). */
(function(){
 if(window.top!==window)return;
 var H=location.hostname||'localhost',G='http://'+H+':8123',S='http://'+H+':9200',p=location.pathname,port=location.port;
 var pages=[['console','Console',G+'/console'],['room','Pièce 3D',G+'/room'],['product','Produit',G+'/produit'],['parts','Composants',G+'/composants'],['steg','STEG opérateur',S+'/']];
 var cur=port==='9200'?'steg':p.indexOf('/room')===0?'room':p.indexOf('/composants')===0?'parts':p.indexOf('/produit')===0?'product':'console';
 var css=document.createElement('style');
 css.textContent='#p1nav{position:fixed;top:0;left:0;right:0;height:42px;z-index:99999;display:flex;align-items:center;gap:4px;padding:0 12px;background:#141b22;border-bottom:1px solid #26323c;font:600 13px system-ui,"Segoe UI",sans-serif;overflow-x:auto;white-space:nowrap}'+
 '#p1nav b{color:#e6edf2;margin-right:10px}#p1nav a{color:#8fa1ad;text-decoration:none;padding:6px 12px;border-radius:8px;border:1px solid transparent}'+
 '#p1nav a:hover{color:#e6edf2}#p1nav a[aria-current=page]{color:#e6edf2;background:#0c1116;border-color:#26323c}#p1nav a:focus-visible{outline:2px solid #38bdf8;outline-offset:1px}'+
 '#p1nav .st{margin-left:auto;display:flex;gap:12px;font-weight:400;font-size:12px;color:#8fa1ad;padding-left:12px}#p1nav i{display:inline-block;width:8px;height:8px;border-radius:50%;background:#55606a;margin-right:5px}#p1nav i.ok{background:#34d399}#p1nav i.bad{background:#f43f5e}'+
 'body{padding-top:42px!important}';
 document.head.appendChild(css);
 var n=document.createElement('nav');n.id='p1nav';n.setAttribute('aria-label','Démos');
 var b=document.createElement('b');b.textContent='Prise P1';n.appendChild(b);
 pages.forEach(function(x){var a=document.createElement('a');a.textContent=x[1];a.href=x[2];if(x[0]===cur)a.setAttribute('aria-current','page');n.appendChild(a)});
 var st=document.createElement('span');st.className='st';st.innerHTML='<span><i id="p1d1"></i>prise</span><span><i id="p1d2"></i>concentrateur</span><span><i id="p1d3"></i>STEG</span>';n.appendChild(st);
 document.body.insertBefore(n,document.body.firstChild);
 function dot(id,ok){var e=document.getElementById(id);if(e)e.className=ok===null?'':ok?'ok':'bad'}
 function poll(){
  fetch(G+'/api/last').then(function(r){return r.json()}).then(function(t){dot('p1d1',!!t)}).catch(function(){dot('p1d1',false)});
  fetch('http://'+H+':9100/api/state').then(function(r){return r.json()}).then(function(s){dot('p1d2',true);dot('p1d3',s.steg_ok===false?false:s.steg_ok===true?true:null)}).catch(function(){dot('p1d2',false);dot('p1d3',false)});
 }
 poll();setInterval(poll,2500);
})();
