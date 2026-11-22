import {loadSales,fixedAnalysis,questions,median,profiles} from './analysis.mjs';
const $=id=>document.getElementById(id);
const money=x=>x==null?'—':new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(x);
const num=x=>x==null?'—':Number(x).toLocaleString('en-US',{maximumFractionDigits:1});
const pct=x=>num(x)+'%';
const display=n=>({'The Pennsylvania State University':'Penn State','The University of North Carolina at Chapel Hill':'UNC Chapel Hill','The University of Iowa':'Iowa','University of California, Davis':'UC Davis','University of Wisconsin-Madison':'Wisconsin–Madison','University of Illinois Urbana-Champaign':'Illinois Urbana-Champaign','Purdue University':'Purdue'}[n]||n.replace(/^University of /,''));
const safe=x=>String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const months='January February March April May June July August September October November December'.split(' ');
const sorted=(rows,key)=>[...rows].sort((a,b)=>(b[key]??-Infinity)-(a[key]??-Infinity)||a.name.localeCompare(b.name));
const extreme=(rows,key,mode='max')=>{const non=rows.filter(x=>Number.isFinite(x[key]));const v=Math[mode](...non.map(r=>r[key]));return {v,names:non.filter(r=>r[key]===v).map(r=>display(r.name)).join(', ')}};
function option(v,l){return '<option value="'+safe(v)+'">'+safe(l)+'</option>'}
const params=new URLSearchParams(location.search);
function control(id,label,values,initial,attrs=''){
  const value=params.get(id)??String(initial??'');
  if(values){const select='<select id="'+id+'">'+values.map(v=>{const [k,l]=Array.isArray(v)?v:[v,display(String(v))];return option(k,l)}).join('')+'</select>';
    return '<label>'+label+select.replace(/<option value="([^"]*)"/g,(m,k)=>k===safe(value)?m+' selected':m)+'</label>';}
  return '<label>'+label+'<input id="'+id+'" type="number" value="'+safe(value)+'" '+attrs+'></label>';
}
function table(head,rows){return '<table><thead><tr>'+head.map(h=>'<th scope="col">'+safe(h)+'</th>').join('')+'</tr></thead><tbody>'+rows.map(r=>'<tr>'+r.map((v,i)=>i===0?'<th scope="row">'+safe(v)+'</th>':'<td>'+safe(v)+'</td>').join('')+'</tr>').join('')+'</tbody></table>'}
function chart(rows,key,fmt,axis,win,extra){
  const max=Math.max(1,...rows.map(r=>Math.abs(r[key]||0)));
  return '<figure><figcaption>'+safe(axis)+'</figcaption>'+rows.map(r=>'<div class="barrow"><span>'+safe(display(r.name))+'</span><span class="track"><i class="'+(r[key]===win?'winner ':'')+(r[key]<0?'negative':'')+'" style="width:'+Math.abs((r[key]||0)/max)*100+'%"></i></span><b>'+safe(r[key]===null?'—':fmt(r[key]))+(extra?'<small>'+safe(extra(r))+'</small>':'')+'</b></div>').join('')+'</figure>';
}
function section(parent,id,title,controls=''){
  const a=document.createElement('article');a.id='q'+id;
  a.innerHTML='<div class="article-head"><span class="qid">Q'+id+'</span><h3>'+title+'</h3></div><div class="controls">'+controls+'</div><p class="answer"></p><div class="visual"></div>';
  parent.append(a);return a;
}
function fill(id,answer,v){const a=$('q'+id);a.querySelector('.answer').textContent=answer;a.querySelector('.visual').innerHTML=v;}
function renderFixed(db){
  const {cities,cmp,campuses}=db;
  ['Where are median prices highest?','Which city has the widest mean–median gap?','Which cities change rank after applying the price rule?','How did campus prices change from 2024 to 2025?','Where do listed homes go under contract fastest?','Where is the annual property tax burden highest?'].forEach((t,i)=>section($('fixed'),i+1,t));
  let win=extreme(cities,'price');
  fill(1,win.names+' has the highest median sale price at '+money(win.v)+'.',chart(sorted(cities,'price'),'price',money,'Median sale price by city · US dollars',win.v));
  win=extreme(cmp,'gap');const biggest=cmp.find(r=>r.gap===win.v);
  fill(2,win.names+' has the largest gap. Its mean of '+money(biggest.mean)+' is '+pct(win.v)+' above its median of '+money(biggest.price)+'. A small group of very high sales pulls the mean upward. The median depends on the middle sales.',chart(sorted(cmp,'gap'),'gap',pct,'Mean above median · percent of median',win.v)+table(['City','Mean','Median'],sorted(cmp,'gap').map(r=>[r.name,money(r.mean),money(r.price)])));
  const moves=cmp.filter(r=>r.rawRank!==r.cleanRank);
  fill(3,moves.map(r=>r.name+' moves '+(r.cleanRank<r.rawRank?'up ':'down ')+Math.abs(r.cleanRank-r.rawRank)+' ('+r.rawRank+' to '+r.cleanRank+')').join('. ')+'. All other cities keep their ranks.',rankChart(cmp));
  const gain=extreme(campuses,'change'),loss=campuses.filter(c=>c.change<0);
  fill(4,gain.names+' leads with a '+pct(gain.v)+' increase. Declines: '+loss.map(r=>display(r.name)+' ('+pct(r.change)+')').join(', ')+'.',chart(sorted(campuses,'change'),'change',pct,'Median price change · 2024 to 2025 (%)',gain.v,r=>money(r.p24)+' → '+money(r.p25)));
  const fast=extreme(campuses,'days','min'),slow=extreme(campuses,'days');
  fill(5,'Fastest: '+fast.names+' ('+num(fast.v)+' days). Slowest: '+slow.names+' ('+num(slow.v)+' days).',chart(sorted(campuses,'days'),'days',num,'Median days from listing to contract · days',fast.v));
  const high=extreme(campuses,'tax'),low=extreme(campuses,'tax','min');
  fill(6,'Highest: '+high.names+' ('+high.v.toFixed(2)+'%). Lowest: '+low.names+' ('+low.v.toFixed(2)+'%).',chart(sorted(campuses,'tax'),'tax',v=>v.toFixed(2)+'%','Total annual tax divided by total sale price · percent',high.v));
}
function rankChart(data){
  const rows=[...data].sort((a,b)=>a.rawRank-b.rawRank);
  return '<figure><figcaption>Rank by mean price · 1 is highest</figcaption><div class="rankhead"><span>City</span><span>All → scoped</span></div>'+rows.map(r=>'<div class="rankline"><span>'+safe(r.name)+'</span><svg viewBox="0 0 100 12" preserveAspectRatio="none" aria-hidden="true"><line x1="'+r.rawRank*5+'" y1="1" x2="'+r.cleanRank*5+'" y2="11"/><circle cx="'+r.rawRank*5+'" cy="2" r="1.5"/><circle cx="'+r.cleanRank*5+'" cy="10" r="1.5"/></svg><b>'+r.rawRank+' → '+r.cleanRank+'</b></div>').join('')+'</figure>';
}
function monthChart(values){
  const peak=Math.max(1,...values);
  return '<figure><figcaption>Monthly sales · number of transactions</figcaption><div class="columns">'+values.map((n,i)=>'<div title="'+months[i]+': '+n+'"><b>'+n+'</b><i class="'+(n===peak?'winner':'')+'" style="height:'+Math.max(1,92*n/peak)+'px"></i><small>'+months[i].slice(0,3)+'</small></div>').join('')+'</div></figure>';
}
function setupScenarios(cities,campuses,years,beds){
  const p=$('dynamic');
  section(p,7,'Which city is most affordable at a given bedroom count?',control('q7beds','Exact bedrooms',beds,3));
  section(p,8,'Where do homes go under contract fastest within a budget?',control('q8lo','Minimum price ($)',null,100000,'min="0"')+control('q8hi','Maximum price ($)',null,400000,'min="0"'));
  section(p,9,'When did a city record the most sales?',control('q9city','City',cities,'Champaign, IL')+control('q9year','Sale year',years,'2025'));
  section(p,10,'How far from campus can a budget reach?',control('q10campus','Campus area',campuses,'University of Illinois Urbana-Champaign')+control('q10max','Maximum price ($)',null,400000,'min="0"')+control('q10beds','Minimum bedrooms',null,3,'min="0" step="1"'));
}
const value=id=>$(id).value, numeric=(id,fallback)=>value(id)===''?fallback:Number(value(id));
function renderScenarios(all,db,names){
 const s={beds:Number(value('q7beds')),lo:numeric('q8lo',0),hi:numeric('q8hi',Infinity),city:value('q9city'),year:value('q9year'),campus:value('q10campus'),max:numeric('q10max',Infinity),minBeds:numeric('q10beds',0)};
 const r=questions(all,db.valid,s,names);
 const cheapest=extreme(r.bed,'price','min'),quick=extreme(r.budget,'days','min');
 fill(7,cheapest.names?cheapest.names+' has the lowest median price for '+s.beds+' bedrooms: '+money(cheapest.v)+'.':'No sales match this bedroom count.',chart(sorted(r.bed,'price'),'price',money,'Median price · exact bedroom count',cheapest.v,c=>num(c.n)+' sales'));
 fill(8,quick.names?quick.names+' has the shortest median time: '+num(quick.v)+' days. Counts include sales with both dates.':'No sales with both dates match this range.',chart(sorted(r.budget,'days'),'days',num,'Median days on market · selected price range',quick.v,c=>num(c.n)+' sales'));
 const top=Math.max(...r.months),namesM=months.filter((m,i)=>r.months[i]===top);
 fill(9,top?namesM.join(', ')+' recorded the most sales in '+s.city+' in '+s.year+' ('+num(top)+').':'No dated sales for this city and year.',monthChart(r.months));
 const bins=[0,1,3,5,10], labels=['0–1','>1–3','>3–5','>5–10','>10'];
 const dist=bins.map((_,i)=>({name:labels[i]+' mi',n:r.near.filter(x=>(i===0||x.miles>bins[i])&&(i===4||x.miles<=bins[i+1])).length}));
 fill(10,r.near.length?num(r.near.length)+' qualifying sales have a median distance of '+num(r.distance)+' miles from campus.':'No home sales meet these conditions.',chart(dist,'n',num,'Distance to campus · number of qualifying sales',null));
}
function setupExplore(campuses,cities,years,beds,limit){
 const all=[['','All']];
 $('filters').innerHTML=control('campus','Campus area',[...all,...campuses],'')+control('city','City',[...all,...cities],'')+control('year','Sale year',[...all,...years],'')+control('beds','Exact bedrooms',[...all,...beds],'')+control('lo','Minimum price ($)',null,10000,'min="0"')+control('hi','Maximum price ($)',null,5000000,'min="0"')+control('basement','Basement',[['','Any'],['1','Yes'],['0','No'],['unknown','Unknown']],'')+control('nearLo','Minimum miles',null,0,'min="0" max="'+limit+'" step="0.1"')+control('nearHi','Maximum miles',null,limit,'min="0" max="'+limit+'" step="0.1"')+
 '<div class="range-pair"><label>Minimum distance slider<input id="slideLo" type="range" min="0" max="'+limit+'" step="0.1"></label><label>Maximum distance slider<input id="slideHi" type="range" min="0" max="'+limit+'" step="0.1"></label></div><button type="button" id="reset">Reset filters</button>';
 $('compare-controls').innerHTML=control('campusA','First campus',campuses,'University of Illinois Urbana-Champaign')+control('campusB','Second campus',campuses,'Purdue University');
}
let sortKey='n',direction=-1;
function compare(db){
 const profilesByName=new Map(profiles(db.valid,'campus').map(r=>[r.name,r]));
 const a=profilesByName.get(value('campusA')),b=profilesByName.get(value('campusB'));
 $('comparison').innerHTML=table(['Market',display(a.name),display(b.name)],[['Median price',money(a.price),money(b.price)],['Recorded sales',num(a.n),num(b.n)]]);
}
function mapOf(campuses,active){
 // Equirectangular projection, with the horizontal axis corrected for latitude 38°N.
 const px=lon=>(lon+125)*8.8+16,py=lat=>(50-lat)*11+8;
 const yLine=lat=>'<path class="grid" d="M8 '+py(lat)+'H565"/><text x="8" y="'+(py(lat)-3)+'">'+lat+'°N</text>';
 const xLine=lon=>'<path class="grid" d="M'+px(lon)+' 8V281"/><text x="'+(px(lon)+2)+'" y="279">'+Math.abs(lon)+'°W</text>';
 const pts=campuses.map(c=>'<g class="pin '+(active===c.name?'picked':'')+'" role="button" tabindex="0" aria-label="'+safe(display(c.name))+'" data-campus="'+safe(c.name)+'"><title>'+safe(display(c.name))+'</title><circle class="hit" cx="'+px(c.lon)+'" cy="'+py(c.lat)+'" r="12"/><circle cx="'+px(c.lon)+'" cy="'+py(c.lat)+'" r="5"/></g>').join('');
 return '<svg role="group" aria-label="Interactive map of US campus areas" viewBox="0 0 575 286">'+[30,35,40,45].map(yLine).join('')+[-120,-105,-90,-75].map(xLine).join('')+pts+'</svg><div class="mapkey">'+campuses.map(c=>'<button data-campus="'+safe(c.name)+'" aria-pressed="'+(c.name===active)+'">'+safe(display(c.name))+'</button>').join('')+'</div>';
}
function cityTable(rows){
 const keys=[['name','City'],['n','Sales'],['price','Median price'],['days','Median days']];
 const data=profiles(rows,'city').sort((a,b)=>{
  if(a[sortKey]==null)return b[sortKey]==null?0:1;if(b[sortKey]==null)return -1;
  return direction*(typeof a[sortKey]==='string'?a[sortKey].localeCompare(b[sortKey]):a[sortKey]-b[sortKey]);});
 const arrow=(up)=>'<svg viewBox="0 0 12 12" aria-hidden="true"><path d="'+(up?'M2 8l4-4 4 4':'M2 4l4 4 4-4')+'"/></svg>';
 $('table').innerHTML=data.length?'<table><thead><tr>'+keys.map(([k,label])=>'<th scope="col" aria-sort="'+(k===sortKey?(direction>0?'ascending':'descending'):'none')+'"><button data-sort="'+k+'">'+label+arrow(k===sortKey&&direction>0)+'</button></th>').join('')+'</tr></thead><tbody>'+data.map(r=>'<tr><th scope="row">'+safe(r.name)+'</th><td>'+num(r.n)+'</td><td>'+money(r.price)+'</td><td>'+num(r.days)+'</td></tr>').join('')+'</tbody></table>':'<p>No sales match all filters. Widen the price or distance range, or reset the selection.</p>';
}
function renderExplore(db){
 const rows=db.valid.filter(r=>(!value('campus')||r.campus===value('campus'))&&(!value('city')||r.city===value('city'))&&(!value('year')||r.year===value('year'))&&(!value('beds')||r.beds===Number(value('beds')))&&(!value('basement')||r.basement===value('basement'))&&r.price>=numeric('lo',0)&&r.price<=numeric('hi',Infinity)&&r.miles>=numeric('nearLo',0)&&r.miles<=numeric('nearHi',Infinity));
 $('slideLo').value=value('nearLo');$('slideHi').value=value('nearHi');
 $('kpis').innerHTML=[['Sales',num(rows.length)],['Median price',money(median(rows.map(r=>r.price)))],['Median days on market',num(median(rows.map(r=>r.days)))]].map(([k,v])=>'<div><span>'+k+'</span><strong>'+v+'</strong></div>').join('');
 $('map').innerHTML=mapOf(db.campuses,value('campus'));cityTable(rows);
}
function insights(all,db){
 const c=extreme(db.cmp,'gap'),r=db.cmp.find(x=>x.gap===c.v);
 const low=all.filter(r=>r.price<10000).length,high=all.filter(r=>r.price>5000000).length;
 const scopedCity=db.cities.find(x=>x.name===r.name);
 $('essays').innerHTML='<article><h3>What one price rule changes</h3><p>For a buyer comparing college towns, a typical transaction and the average dollar value of a sale answer different questions. The distinction becomes particularly important in '+safe(r.name)+'. Across all transactions there, the mean is '+money(r.mean)+' and the median is '+money(r.price)+'. Applying the stated price range changes the mean to '+money(r.cleanMean)+' and the median to '+money(scopedCity.price)+'. A high-priced sale has its entire dollar value counted in a mean. For a median, it affects which sale occupies the middle position.</p><p>The scope removes '+low+' sales below $10,000 and '+high+' above $5 million across the collection. That boundary excludes a mixture of unlikely records and potentially genuine luxury transactions. Deleting those records permanently would make it impossible to show the size of the difference. The report therefore retains every source observation, applies the price rule to the affordability questions, and preserves the unrestricted market for the two comparisons that explicitly request it. A reader who cares about total dollar volume can see why the choice matters, even when a typical buyer sees little difference in the median.</p>'+table(['Scope in '+r.name,'Mean','Median'],[['All sales',money(r.mean),money(r.price)],['In price range',money(r.cleanMean),money(scopedCity.price)]])+'</article>'+
 '<article><h3>Using a coding agent and checking its work</h3><p>The first version of Campus Atlas used one price-filtered table for every display. That was convenient for exploring a typical sale. It could not answer the new question about how far the mean stands above the median when every transaction is counted. Building the new report with a coding agent made it practical to maintain two populations, connect controls to charts, and put the result on a website that a reader can use without opening a notebook.</p><p>For checking results, a separate SQL query or a short notebook still has an advantage. It makes the denominator visible. For the tax comparison, dividing the sum of eligible taxes by the sum of their corresponding prices answers a different question from averaging the individual tax ratios. Changing a label would never reveal that mistake. For this project the preferred workflow is to verify numerical definitions against the original data, then use the coding agent to turn those definitions into an interactive report. Repeating a check with a new price boundary or with a city that has no qualifying sales tests whether the controls change the calculation as well as the text.</p></article>';
}
const theme=$('theme');
function setTheme(dark){document.documentElement.dataset.theme=dark?'dark':'light';theme.setAttribute('aria-pressed',dark);theme.textContent=dark?'Light mode':'Dark mode';}
setTheme(localStorage.getItem('campus-theme')==='dark');
theme.onclick=()=>{const dark=theme.getAttribute('aria-pressed')!=='true';setTheme(dark);localStorage.setItem('campus-theme',dark?'dark':'light');};
async function start(){
 const result=await fetch('data/college_town_home_sales.csv');if(!result.ok)throw Error('data unavailable');
 const all=loadSales(await result.text()),db=fixedAnalysis(all);
 const cityNames=db.cities.map(c=>c.name).sort(),campuses=db.campuses.map(c=>c.name).sort(),years=[...new Set(all.map(r=>r.year).filter(Boolean))].sort(),beds=[...new Set(all.map(r=>r.beds))].sort((a,b)=>a-b),limit=Math.ceil(Math.max(...db.valid.map(r=>r.miles)));
 $('total').textContent=num(all.length);$('status').hidden=true;renderFixed(db);setupScenarios(cityNames,campuses,years,beds);setupExplore(campuses,cityNames,years,beds,limit);insights(all,db);
 const lead=extreme(db.cities,'price');
 $('hero-finding').textContent=lead.names+' leads all cities at a median of '+money(lead.v)+'.';
 for(const article of document.querySelectorAll('#fixed article,#dynamic article')) {
   $('jump').add(new Option(article.querySelector('.qid').textContent+' · '+article.querySelector('h3').textContent,article.id));
 }
 $('jump').onchange=()=>{const id=$('jump').value;if(id){location.hash=id;$(id).setAttribute('tabindex','-1');$(id).focus({preventScroll:true});}};
 const preview=()=>renderScenarios(all,db,cityNames);
 const updateURL=()=>{const url=new URL(location.href);for(const e of document.querySelectorAll('.controls select,.controls input[type=number]')){if(e.value)url.searchParams.set(e.id,e.value);else url.searchParams.delete(e.id);}history.replaceState(null,'',url)};
 preview();renderExplore(db);compare(db);
 $('dynamic').addEventListener('input',()=>{preview();updateURL()});
 $('filters').addEventListener('input',e=>{if(e.target.id==='slideLo')$('nearLo').value=e.target.value;if(e.target.id==='slideHi')$('nearHi').value=e.target.value;renderExplore(db);updateURL()});
 $('reset').onclick=()=>{for(const [id,v] of Object.entries({campus:'',city:'',year:'',beds:'',basement:'',lo:10000,hi:5000000,nearLo:0,nearHi:limit}))$(id).value=v;renderExplore(db);updateURL();};
 const pick=e=>{const target=e.target.closest('[data-campus]');if(target){$('campus').value=target.dataset.campus;renderExplore(db);updateURL();}};
 $('map').addEventListener('click',pick);$('map').addEventListener('keydown',e=>{if(e.target.tagName.toLowerCase()==='g'&&['Enter',' '].includes(e.key)){e.preventDefault();pick(e);}});
 $('compare-controls').addEventListener('input',()=>{compare(db);updateURL()});
 $('table').addEventListener('click',e=>{const b=e.target.closest('[data-sort]');if(!b)return;direction=b.dataset.sort===sortKey?-direction:(b.dataset.sort==='name'?1:-1);sortKey=b.dataset.sort;renderExplore(db);});
}
start().catch(e=>{$('status').hidden=false;$('status').textContent='The sales data could not be loaded. Reload this page to try again.';console.error(e);});
