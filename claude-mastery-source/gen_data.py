import random, json, datetime as dt
random.seed(7)
D={}
def csv(rows): return "\n".join(",".join(str(c) for c in r) for r in rows)
regions=["Cairo","Alexandria","Delta","Upper Egypt","Riyadh","Dubai"]
reps=["Ahmed","Mona","Karim","Sara","Omar","Nour"]
prods=["Starter","Pro","Enterprise","Training","Consulting"]
cust=[f"C{100+i}" for i in range(30)]
# CRM deals
r=[["deal_id","customer","rep","stage","amount_egp","close_date","last_activity_days","product","decision_maker_met","competitor"]]
stages=["Prospect","Qualified","Proposal","Negotiation","Won","Lost"]
for i in range(24):
    r.append([f"D{2000+i}",random.choice(cust),random.choice(reps),random.choice(stages),random.randint(40,900)*1000,f"2026-{random.randint(10,12):02d}-{random.randint(1,28):02d}",random.randint(0,45),random.choice(prods),random.choice(["Yes","No"]),random.choice(["None","Competitor A","Competitor B"])])
D["crm_deals"]=("CRM deals","صفقات CRM",csv(r))
# CRM activities
r=[["deal_id","date","type","outcome","notes"]]
for i in range(20):
    r.append([f"D{2000+random.randint(0,23)}",f"2026-09-{random.randint(1,30):02d}",random.choice(["Call","Email","Meeting","Demo"]),random.choice(["Positive","Neutral","No reply","Objection: price"]),random.choice(["asked for discount","needs CFO approval","comparing vendors","ready to sign","budget next quarter"])])
D["crm_activities"]=("CRM activities","أنشطة CRM",csv(r))
# monthly sales 36m
r=[["month","region","product","units","revenue_egp","price_egp","promo"]]
base={"Starter":120,"Pro":60,"Enterprise":12}
for m in range(36):
    y=2023+m//12; mo=m%12+1
    for p,b in base.items():
        season=1.25 if mo in (3,4) else (0.85 if mo in (7,8) else 1)
        u=int(b*(1+0.02*m)*season*random.uniform(0.9,1.1)); price={"Starter":1500,"Pro":4500,"Enterprise":25000}[p]*(1+0.01*m)
        r.append([f"{y}-{mo:02d}","All",p,u,int(u*price),int(price),random.choice(["No","No","Yes"])])
D["sales_monthly"]=("Monthly sales 36 months","مبيعات شهرية 36 شهر",csv(r))
# customers churn
r=[["customer","segment","tenure_months","monthly_spend_egp","orders_last_90d","support_tickets_90d","last_order_days","nps"]]
for c in cust: r.append([c,random.choice(["SME","Corporate","Retail"]),random.randint(2,60),random.randint(5,200)*1000,random.randint(0,15),random.randint(0,8),random.randint(1,150),random.randint(-50,80)])
D["customers"]=("Customer health","صحة العملاء",csv(r))
# baskets
items=["Excel course","Claude course","FP&A templates","DCF model","Coaching hour","Certificate","Workbook","Webinar"]
r=[["order_id","customer","items"]]
for i in range(25): r.append([f"O{500+i}",random.choice(cust),"|".join(random.sample(items,random.randint(1,4)))])
D["baskets"]=("Order baskets","سلال الطلبات",csv(r))
# territories
r=[["rep","region","accounts","pipeline_egp","last_year_sales_egp","market_potential_egp"]]
for rep,reg in zip(reps,regions): r.append([rep,reg,random.randint(20,80),random.randint(2,9)*1_000_000,random.randint(3,12)*1_000_000,random.randint(15,40)*1_000_000])
D["territories"]=("Territories","المناطق البيعية",csv(r))
# pricing
r=[["deal_id","list_price","discount_pct","units","won","customer_segment"]]
for i in range(24): d=random.choice([0,5,10,15,20,25,30]); r.append([f"P{i}",4500,d,random.randint(1,40),"Yes" if random.random()<0.35+d/100 else "No",random.choice(["SME","Corporate"])])
D["pricing"]=("Discount & win data","بيانات الخصم والفوز",csv(r))
# commissions
r=[["rep","month","booked_egp","collected_egp","quota_egp","plan_rate_pct","accelerator_above_quota_pct"]]
for rep in reps: r.append([rep,"2026-09",random.randint(6,15)*100000,random.randint(4,12)*100000,1000000,3,5])
D["commissions"]=("Commission inputs","مدخلات العمولات",csv(r))
# budget vs actual
lines=["Revenue","COGS","Salaries","Marketing","Rent","IT","Travel","Utilities"]
r=[["line","month","budget_egp_k","actual_egp_k","ly_egp_k"]]
for l in lines:
    b=random.randint(200,15000); r.append([l,"2026-09",b,int(b*random.uniform(0.85,1.18)),int(b*random.uniform(0.8,1.05))])
D["bva"]=("Budget vs actual","موازنة مقابل فعلي",csv(r))
# AR aging
r=[["customer","invoice","amount_egp","due_date","days_overdue","bucket"]]
for i in range(15):
    od=random.choice([0,10,35,65,95,130]); r.append([random.choice(cust),f"INV-{7000+i}",random.randint(20,600)*1000,f"2026-{random.randint(6,10):02d}-{random.randint(1,28):02d}",od,"0-30" if od<=30 else "31-60" if od<=60 else "61-90" if od<=90 else "90+"])
D["ar_aging"]=("AR aging","أعمار العملاء",csv(r))
r=[["supplier","invoice","amount","currency","due_date"]]
for i in range(12): r.append([random.choice(["Supplier X","Supplier Y","Supplier Z","Port Co","Logistics Ltd"]),f"AP-{300+i}",random.randint(10,400)*1000,random.choice(["EGP","USD"]),f"2026-{random.randint(10,12):02d}-{random.randint(1,28):02d}"])
D["ap_aging"]=("AP schedule","جدول الموردين",csv(r))
# bank vs gl
r=[["source","date","reference","description","amount_egp"]]
for i in range(10):
    a=random.randint(-300,500)*1000; d=f"2026-09-{random.randint(1,30):02d}"
    r.append(["BANK",d,f"R{900+i}",random.choice(["Transfer in","Cheque","Fees","Supplier payment"]),a])
    if i not in (3,7): r.append(["GL",d,f"R{900+i}","Posted",a if i!=5 else a+1500])
r.append(["GL","2026-09-30","R999","Cheque not presented",-120000])
D["bank_gl"]=("Bank vs GL","البنك مقابل الأستاذ",csv(r))
# credit financials
D["credit_fin"]=("Borrower financials","قوائم المقترض",csv([["item","2023","2024","2025"],["Revenue",180000,220000,265000],["EBITDA",27000,31000,36500],["Interest expense",6200,8100,9400],["Net income",11000,12500,14100],["Total debt",62000,78000,96000],["Cash",9000,7500,6800],["Current assets",71000,84000,99000],["Current liabilities",55000,69000,83000],["Equity",61000,70500,81000],["Annual debt service",14000,17500,21000]]))
D["dcf_inputs"]=("DCF inputs","مدخلات DCF",csv([["item","value"],["Revenue 2025 (EGP m)",265],["Revenue growth y1-y5 %","18,16,14,12,10"],["EBIT margin %",14],["Tax rate %",22.5],["Capex % revenue",5],["D&A % revenue",4],["NWC % revenue",12],["Risk-free %",22],["Beta",1.1],["Equity risk premium %",6],["Country risk premium %",5],["Pre-tax cost of debt %",26],["Target D/E",0.6],["Terminal growth %",8],["Net debt (EGP m)",89]]))
# expenses
r=[["claim_id","employee","date","category","amount_egp","merchant","receipt"]]
for i in range(20):
    cat=random.choice(["Meals","Taxi","Hotel","Office","Gifts"]); amt=random.randint(80,4000)
    r.append([f"E{i+1}",random.choice(reps),f"2026-09-{random.choice([5,6,12,13,19,20,26,27]):02d}",cat,amt if i not in (4,11) else 9999,random.choice(["Cafe Nile","Uber","Hotel Plaza","Office Mart","Gift Shop"]),random.choice(["Yes","Yes","No"])])
r.append(["E21","Mona","2026-09-12","Meals",850,"Cafe Nile","Yes"]); r.append(["E22","Mona","2026-09-12","Meals",850,"Cafe Nile","Yes"])
D["expenses"]=("Expense claims","مطالبات المصروفات",csv(r))
D["lc"]=("LC & documents (simulated)","اعتماد ومستندات (محاكاة)",csv([["field","LC (MT700)","Invoice","Bill of lading","Certificate of origin"],["Applicant","Nile Trade Co., Cairo","Nile Trade Co., Cairo","To order","Nile Trade Co."],["Beneficiary","Euro Foods GmbH","Euro Foods GmbH","Shipper: Euro Foods GmbH","Euro Foods GmbH"],["Goods","500 MT milk powder","500 MT milk powder","500 MT milk powder","500 MT milk powder"],["Amount","USD 1,250,000","USD 1,262,500","",""],["Incoterm","CIF Alexandria","CIF Alexandria","",""],["Latest shipment","2026-09-15","","Shipped on board 2026-09-18",""],["Port of loading","Hamburg","","Hamburg",""],["Port of discharge","Alexandria","","Alexandria",""],["Expiry","2026-10-10","","",""],["Documents within days","21","","",""]]))
# HR
r=[["employee","department","grade","tenure_years","salary_egp","last_rating","promotions_3y","overtime_hours_m","engagement","left_company"]]
for i in range(24): r.append([f"EMP{i+1}",random.choice(["Finance","Sales","Ops","HR","IT"]),random.choice(["G3","G4","G5","G6"]),round(random.uniform(0.5,12),1),random.randint(12,60)*1000,random.choice([2,3,3,4,5]),random.randint(0,2),random.randint(0,40),random.randint(40,95),random.choice(["No","No","No","Yes"])])
D["employees"]=("Employees","الموظفين",csv(r))
# marketing campaigns
r=[["campaign","channel","spend_egp","impressions","clicks","leads","sales","revenue_egp"]]
for c in ["Webinar Oct","LinkedIn Ads","Instagram Reels","Email Nurture","WhatsApp Broadcast","Google Search"]:
    s=random.randint(10,120)*1000; cl=random.randint(500,9000); ld=int(cl*random.uniform(0.03,0.15)); sa=int(ld*random.uniform(0.05,0.25))
    r.append([c,c.split()[0],s,cl*random.randint(10,40),cl,ld,sa,sa*random.choice([4500,7500,12000])])
D["campaigns"]=("Campaign results","نتايج الحملات",csv(r))
r=[["post","platform","format","pillar","impressions","engagement","saves","follows"]]
for i in range(16): r.append([f"Post {i+1}",random.choice(["LinkedIn","Instagram","YouTube"]),random.choice(["Carousel","Text","Video","Poll"]),random.choice(["AI tools","FP&A","Trade finance","Careers"]),random.randint(800,40000),random.randint(20,2500),random.randint(0,600),random.randint(0,120)])
D["social"]=("Social post performance","أداء البوستات",csv(r))
# inventory
r=[["sku","on_hand","avg_monthly_sales","lead_time_days","unit_cost_egp","last_sale_days"]]
for i in range(15): r.append([f"SKU{i+1}",random.randint(0,900),random.randint(0,300),random.choice([15,30,60,90]),random.randint(20,900),random.choice([3,10,40,200,260])])
D["inventory"]=("Inventory","المخزون",csv(r))
r=[["supplier","price_usd","quality_score","lead_time_days","payment_days","on_time_pct","risk_note"]]
for s in ["Alpha","Beta","Gamma","Delta"]: r.append([s,random.randint(90,130),random.randint(60,95),random.choice([20,35,50]),random.choice([0,30,60,90]),random.randint(70,99),random.choice(["None","Single factory","New company","Sanctions check pending"])])
D["suppliers"]=("Supplier quotes","عروض الموردين",csv(r))
r=[["ticket","date","channel","language","text"]]
txt=["I was charged twice for my course","متى هيوصل الكتاب؟ اتأخر أسبوع","Cannot log in to the platform","عايز فاتورة ضريبية باسم الشركة","The instructor was excellent, thanks!","Refund please, I can't attend","الشهادة فيها غلط في الاسم","Is there a group discount for 10 people?"]
for i,t in enumerate(txt): r.append([f"T{i+1}","2026-09-2"+str(i%9),random.choice(["Email","WhatsApp","Web"]),"AR" if any("\u0600"<=ch<="\u06ff" for ch in t) else "EN",f'"{t}"'])
D["tickets"]=("Support tickets","تذاكر الدعم",csv(r))
r=[["task","owner","planned_end","actual_or_forecast_end","pct_complete","budget_egp","spent_egp","depends_on"]]
for i,t in enumerate(["Requirements","Data migration","GL setup","AP module","AR module","Reports","UAT","Training","Go-live"]):
    pe=dt.date(2026,7,1)+dt.timedelta(days=15*i); slip=random.choice([0,0,5,12,20])
    r.append([t,random.choice(reps),pe,pe+dt.timedelta(days=slip),random.choice([100,100,80,60,30,0]),random.randint(1,6)*100000,random.randint(1,7)*100000,["", "Requirements","Requirements","GL setup","GL setup","AP module","Reports","UAT","Training"][i]])
D["project"]=("Project plan","خطة المشروع",csv(r))
D["kpis"]=("Company KPIs","مؤشرات الشركة",csv([["kpi","q2","q3","target"],["Revenue (EGP m)",210,226,240],["Gross margin %",41,39,42],["EBITDA margin %",17,15.5,18],["Cash (EGP m)",48,37,45],["DSO days",71,86,65],["Employee turnover % (annualised)",14,19,12],["NPS",42,38,50],["Customers",1180,1215,1300]]))
D["contracts"]=("Contracts register","سجل العقود",csv([["party","type","value_egp","start","end","notice_days","auto_renew","owner"],["CloudSoft","SaaS",480000,"2025-11-01","2026-10-31",60,"Yes","IT"],["Office Tower","Lease",2400000,"2024-01-01","2026-12-31",90,"No","Admin"],["Audit LLP","Services",650000,"2026-01-01","2026-12-31",30,"No","Finance"],["Logistics Ltd","Supply",1800000,"2025-06-01","2026-11-30",45,"Yes","Ops"]]))
D["transactions"]=("Card transactions","عمليات الكروت",csv([["txn","merchant","mcc","amount_egp"],["1","CARREFOUR MAADI",5411,1240],["2","UBER *TRIP",4121,185],["3","VODAFONE CASH",4814,300],["4","مطعم أبو شقرة",5812,640],["5","AMAZON EG",5999,2150],["6","SHELL OUT",5541,900],["7","NETFLIX",4899,240],["8","صيدلية العزبي",5912,320]]))
json.dump({k:{"en":v[0],"ar":v[1],"csv":v[2]} for k,v in D.items()},open("data.json","w"),ensure_ascii=False)
open("data.js","w").write("const DATA="+json.dumps({k:{"en":v[0],"ar":v[1],"csv":v[2]} for k,v in D.items()},ensure_ascii=False)+";\n")
print(len(D))
