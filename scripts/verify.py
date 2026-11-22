"""Cross-check the site's numerical output using the original SQLite copy."""
import json
import sqlite3
import statistics
import subprocess
import sys
from pathlib import Path

root = Path(__file__).resolve().parents[1]
data = Path(sys.argv[1]) if len(sys.argv) > 1 else root / "data"
script = """
import fs from 'node:fs';
import {loadSales,fixedAnalysis,questions} from './analysis.mjs';
const all=loadSales(fs.readFileSync(process.argv[1],'utf8')), db=fixedAnalysis(all), names=db.cities.map(x=>x.name);
const test=[
 {beds:3,lo:100000,hi:400000,city:'Champaign, IL',year:'2025',campus:'University of Illinois Urbana-Champaign',max:400000,minBeds:3},
 {beds:0,lo:400000,hi:400000,city:'Davis, CA',year:'2023',campus:'University of California, Davis',max:9000000,minBeds:2},
 {beds:19,lo:5100000,hi:6000000,city:'Savoy, IL',year:'2026',campus:'Purdue University',max:9999,minBeds:7}];
console.log(JSON.stringify({cities:db.cities,cmp:db.cmp,campuses:db.campuses,tests:test.map(s=>{const q=questions(all,db.valid,s,names);return {s,bed:q.bed,budget:q.budget,months:q.months,n:q.near.length,d:q.distance}})}));
"""
output=json.loads(subprocess.check_output(["node","--input-type=module","-e",script,str(data/"college_town_home_sales.csv")],cwd=root))
conn=sqlite3.connect(f"file:{data/'college_town_home_sales.sqlite'}?mode=ro",uri=True)
class Median:
    def __init__(self): self.values=[]
    def step(self,x):
        if x is not None: self.values.append(x)
    def finalize(self): return statistics.median(self.values) if self.values else None
conn.create_aggregate("median",1,Median)
valid="sale_price BETWEEN 10000 AND 5000000"
city="city||', '||state"
days="julianday(contract_date)-julianday(list_date)"
def records(sql,params=()): return list(conn.execute(sql,params))
count=0
def equal(x,y):
    global count
    assert x==y or (isinstance(x,(float,int)) and isinstance(y,(float,int)) and abs(x-y)<1e-7), (x,y)
    count+=1
for row in output["cmp"]:
    name=row["name"]
    mean,med=records(f"SELECT avg(sale_price),median(sale_price) FROM home_sales WHERE {city}=?",(name,))[0]
    cm,cp=records(f"SELECT avg(sale_price),median(sale_price) FROM home_sales WHERE {valid} AND {city}=?",(name,))[0]
    equal(row["mean"],mean);equal(row["price"],med);equal(row["cleanMean"],cm);equal(row["gap"],(mean-med)*100/med)
    equal(next(x["price"] for x in output["cities"] if x["name"]==name),cp)
    for wh,key in [("1","rawRank"),(valid,"cleanRank")]:
        equal(row[key],dict(records(f"SELECT place,rank() over (order by avgprice desc) FROM (SELECT {city} AS place,avg(sale_price) AS avgprice FROM home_sales WHERE {wh} GROUP BY city,state)"))[name])
for row in output["campuses"]:
    campus=row["name"]
    for year,key in [("2024","p24"),("2025","p25")]:
        equal(row[key],records(f"SELECT median(sale_price) FROM home_sales WHERE {valid} AND university=? AND substr(sale_date,1,4)=?",(campus,year))[0][0])
    equal(row["change"],(row["p25"]-row["p24"])*100/row["p24"])
    equal(row["days"],records(f"SELECT median({days}) FROM home_sales WHERE {valid} AND university=?",(campus,))[0][0])
    equal(row["tax"],records(f"SELECT 100.0*sum(tax_annual_amount)/sum(sale_price) FROM home_sales WHERE {valid} AND university=? AND tax_annual_amount>0 AND tax_annual_amount<sale_price*.1",(campus,))[0][0])
for test in output["tests"]:
    s=test["s"]
    for r in test["bed"]:
        m,n=records(f"SELECT median(sale_price),count(*) FROM home_sales WHERE {valid} AND {city}=? AND beds=?",(r["name"],s["beds"]))[0]
        equal(m,r["price"]);equal(n,r["n"])
    for r in test["budget"]:
        m,n=records(f"SELECT median({days}),count(*) FROM home_sales WHERE {valid} AND {city}=? AND sale_price BETWEEN ? AND ? AND contract_date IS NOT NULL AND list_date IS NOT NULL",(r["name"],s["lo"],s["hi"]))[0]
        equal(m,r["days"]);equal(n,r["n"])
    monthly=dict(records(f"SELECT cast(substr(sale_date,6,2) as integer),count(*) FROM home_sales WHERE {city}=? AND substr(sale_date,1,4)=? GROUP BY 1",(s["city"],s["year"])))
    for month,n in enumerate(test["months"],1): equal(n,monthly.get(month,0))
    d,n=records(f"SELECT median(miles_to_campus),count(*) FROM home_sales WHERE {valid} AND university=? AND sale_price<=? AND beds>=?",(s["campus"],s["max"],s["minBeds"]))[0]
    equal(d,test["d"]);equal(n,test["n"])
print(f"{count} independent SQLite comparisons passed.")
