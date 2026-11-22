// Parse the original CSV once. Commas inside quoted addresses and escaped quotes are legal.
export function parseCSV(text) {
  const records = [];
  let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (quoted && text[i + 1] === '"') { field += '"'; i++; }
      else quoted = !quoted;
    } else if (ch === ',' && !quoted) { row.push(field); field = ''; }
    else if (ch === '\n' && !quoted) { row.push(field.replace(/\r$/, '')); records.push(row); row = []; field = ''; }
    else field += ch;
  }
  if (row.length || field) { row.push(field.replace(/\r$/, '')); records.push(row); }
  return records;
}
export function loadSales(text) {
  const [header, ...rows] = parseCSV(text.replace(/^\uFEFF/, ''));
  const ix = Object.fromEntries(header.map((name, i) => [name, i]));
  return rows.filter(r => r.length === header.length).map(r => {
    const col = k => r[ix[k]], num = k => col(k) === '' ? null : Number(col(k));
    const listed = col('list_date'), contract = col('contract_date'), date = col('sale_date');
    return {id:col('listing_id'), city:col('city')+', '+col('state'), campus:col('university'), date, year:date.slice(0,4),
      price:num('sale_price'), beds:num('beds'), tax:num('tax_annual_amount'), miles:num('miles_to_campus'),
      basement:col('has_basement') || 'unknown', lat:num('latitude'), lon:num('longitude'),
      days:listed && contract ? (Date.parse(contract)-Date.parse(listed))/86400000 : null};
  });
}
export const scoped = r => r.price >= 10000 && r.price <= 5000000;
export function median(values) {
  const a = values.filter(Number.isFinite).sort((x,y)=>x-y);
  if (!a.length) return null;
  const i=Math.floor(a.length/2);
  return a.length%2 ? a[i] : (a[i-1]+a[i])/2;
}
export const sum = a => a.reduce((total,x)=>total+x,0);
export function group(rows,key) {
  const groups=new Map();
  for (const row of rows) {
    const name=row[key];
    if (!groups.has(name)) groups.set(name,[]);
    groups.get(name).push(row);
  }
  return groups;
}
const fieldMedian=(rows,key)=>median(rows.map(r=>r[key]));
export function profiles(rows,key) {
  return [...group(rows,key)].map(([name,sales])=>({name,n:sales.length,price:fieldMedian(sales,'price'),
    mean:sum(sales.map(r=>r.price))/sales.length,days:fieldMedian(sales,'days'),timed:sales.filter(r=>r.days!==null).length}));
}
export function fixedAnalysis(all) {
  const valid=all.filter(scoped), allCity=profiles(all,'city'), cities=profiles(valid,'city');
  const rank=(arr,val)=>1+arr.filter(x=>x.mean>val).length;
  const cmp=allCity.map(c=>{const clean=cities.find(x=>x.name===c.name);return {...c,gap:(c.mean/c.price-1)*100,
    rawRank:rank(allCity,c.mean), cleanRank:rank(cities,clean.mean), cleanMean:clean.mean};});
  const campuses=[...group(valid,'campus')].map(([name,sales])=>{
    const p24=fieldMedian(sales.filter(r=>r.year==='2024'),'price'),p25=fieldMedian(sales.filter(r=>r.year==='2025'),'price');
    const taxed=sales.filter(r=>r.tax>0 && r.tax<r.price*.1);return {name,p24,p25,change:(p25/p24-1)*100,
      days:fieldMedian(sales,'days'), tax:sum(taxed.map(r=>r.tax))/sum(taxed.map(r=>r.price))*100,
      lat:fieldMedian(sales,'lat'),lon:fieldMedian(sales,'lon')};
  });
  return {valid,cities,cmp,campuses};
}
export function questions(all,valid,settings,cityNames) {
  const byBed=new Map(profiles(valid.filter(r=>r.beds===settings.beds),'city').map(c=>[c.name,c]));
  const byBudget=new Map(profiles(valid.filter(r=>r.price>=settings.lo && r.price<=settings.hi && r.days!==null),'city').map(c=>[c.name,c]));
  const months=Array(12).fill(0);
  for(const r of all) if(r.date && r.city===settings.city && r.year===settings.year) months[Number(r.date.slice(5,7))-1]++;
  const near=valid.filter(r=>r.campus===settings.campus && r.price<=settings.max && r.beds>=settings.minBeds);
  return {bed:cityNames.map(name=>byBed.get(name)||{name,n:0,price:null}),
    budget:cityNames.map(name=>byBudget.get(name)||{name,n:0,days:null}),months,near,distance:fieldMedian(near,'miles')};
}
