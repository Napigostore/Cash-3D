/* ================= helpers ================= */
const $=s=>document.querySelector(s);
const TR=1e6,TY=1e9;
const num=v=>Number.isFinite(+v)?+v:0;
function trimNum(v,d){let t=num(v).toFixed(d);if(t.includes('.'))t=t.replace(/0+$/,'').replace(/\.$/,'');return t.replace('.',',');}
function fmt(n){n=num(n);const s=n<0?'-':'';n=Math.abs(Math.round(n));
  if(n>=TY)return s+trimNum(n/TY,2)+' tỷ';
  if(n>=TR)return s+trimNum(n/TR,n>=1e7?1:2)+' tr';
  if(n>=1e3)return s+trimNum(n/1e3,0)+'k';
  return s+n+'đ';}
const fmtD=n=>Math.round(num(n)).toLocaleString('vi-VN')+'đ';
const sgn=n=>(num(n)>=0?'+':'')+fmt(n);
const pct=(v,d=1)=>trimNum(num(v)*100,d)+'%';
const rnd=(a,b,step=1)=>a+Math.floor(Math.random()*(Math.floor((b-a)/step+1e-9)+1))*step;
const rf=(a,b)=>a+Math.random()*(b-a);
const pick=a=>a[Math.floor(Math.random()*a.length)];
const wpick=(a,w)=>{let t=w.reduce((x,y)=>x+y,0),r=Math.random()*t;for(let i=0;i<a.length;i++){r-=w[i];if(r<0)return a[i];}return a[a.length-1];};
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const round1=n=>Math.round(n/1e5)*1e5;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const COLORS=['#e9b949','#4fd18b','#5aa9ff','#ff7a8a','#b98cff','#ff9f43'];
function pmt(P,rate,years){if(P<=0)return 0;const r=rate/12,n=Math.max(1,Math.round(years*12));return r?P*r/(1-Math.pow(1+r,-n)):P/n;}

/* ================= chế độ chơi & thời gian ================= */
const mpt=()=>mode().mpt;     // số tháng cuộc đời mỗi lượt
const START_YEAR=2026;
const MODES={
 easy:{n:'Dễ',sub:'Tập chơi',mpt:4,yMul:1,sMul:1,rMul:1,ftGoal:5e8,infl:0,raise:[.05,.05],promo:0,clRate:.01,scam:false,life:false,teaser:false,news:false,retire:false,insurance:false,goodBias:.6,downSkip:1,benefit:.6,midBonus:[.5,.5],tetBonus:[1,1],doodadMul:.7},
 hard:{n:'Khó',sub:'Như cuộc đời',mpt:4,yMul:.52,sMul:.34,bizRisk:true,rMul:.85,ftGoal:1e9,infl:.035,raise:[0,.08],promo:.08,clRate:.015,scam:true,life:true,teaser:true,news:true,retire:true,insurance:true,goodBias:0,downSkip:2,benefit:.6,midBonus:[0,1],tetBonus:[0,2],doodadMul:1}};
const mode=()=>MODES[(G&&G.mode)||'easy'];
const clr=()=>mode().clRate;
const yearOf=()=>START_YEAR+Math.floor((G&&G.month||0)/12);

/* ================= finance rules (VN, ước tính) ================= */
const TAX={self:15.5*1e6,dep:6.2*1e6,ins:.105,insCap:46.8*1e6,brk:[[5e6,.05],[10e6,.10],[18e6,.15],[32e6,.20],[52e6,.25],[80e6,.30],[Infinity,.35]]};
function pit(taxable){let t=0,prev=0;for(const [cap,r] of TAX.brk){if(taxable>prev)t+=(Math.min(taxable,cap)-prev)*r;prev=cap;}return t;}
function netSalary(g,deps){const ins=Math.min(g,TAX.insCap)*TAX.ins;return {ins,tax:pit(Math.max(0,g-ins-TAX.self-deps*TAX.dep))};}
const CL_STEP=10*TR;
const FEE_BUY_RE=.01, TAX_SELL_RE=.02, RENT_TAX=.1, RENT_TAX_TH=100*TR;
const STK_FEE=.0015, STK_TAX=.001, DIV_TAX=.05, BOND_TAX=.05, DEP_RATE=.05;
const BOT_MS=1700;

/* ================= game data ================= */
const LIAB_LABEL={home:'Vay mua nhà',moto:'Trả góp xe máy',car:'Vay mua ô tô',card:'Thẻ tín dụng',phone:'Trả góp điện thoại',laptop:'Trả góp laptop',study:'Vay học phí'};
const T=x=>x*TR;
const PROFS=[
 {n:'Công nhân',age:22,sal:8,rent:1.5,liv:3,L:{moto:[10,.6],phone:[6,.5]},ch:2,sav:12},
 {n:'Giáo viên',age:24,sal:10,rent:2,liv:3.8,L:{moto:[15,.8],card:[10,.5]},ch:2.5,sav:20},
 {n:'Điều dưỡng',age:23,sal:11,rent:2.2,liv:4,L:{moto:[12,.7],card:[8,.4]},ch:2.5,sav:18},
 {n:'Tài xế công nghệ',age:25,sal:12,rent:2.5,liv:4.5,L:{moto:[20,1.2],phone:[8,.7]},ch:2.5,sav:15},
 {n:'Nhân viên văn phòng',age:24,sal:13,rent:3,liv:5,L:{moto:[15,.8],card:[15,.8]},ch:3,sav:30},
 {n:'Đầu bếp',age:24,sal:14,rent:3,liv:5,L:{moto:[15,.8],card:[10,.5]},ch:3,sav:25},
 {n:'Kế toán',age:24,sal:15,rent:3.5,liv:5.5,L:{moto:[18,.9],card:[12,.6]},ch:3,sav:40},
 {n:'Kỹ sư xây dựng',age:25,sal:20,rent:4,liv:6.5,L:{car:[150,3.2],card:[15,.8]},ch:3.5,sav:60},
 {n:'Lập trình viên',age:25,sal:30,rent:6,liv:8,L:{laptop:[24,2],card:[30,1.5]},ch:4.5,sav:120},
 {n:'Trưởng phòng kinh doanh',age:30,sal:35,rent:0,liv:6,L:{home:[1200,10.8],car:[250,5],card:[40,2]},ch:5,sav:150},
 {n:'Bác sĩ',age:28,sal:40,rent:0,liv:6,L:{home:[1500,13.5],car:[250,5],study:[200,4]},ch:5,sav:120},
 {n:'Phi công',age:29,sal:90,rent:0,liv:11,L:{home:[2600,23],car:[500,10],card:[60,3]},ch:7,sav:400},
];
const SCENARIOS={
 normal:{n:'Bình thường',d:'Bắt đầu như nghề đã chọn.'},
 grad:{n:'Mới ra trường',d:'22 tuổi, tiết kiệm chỉ 5 tr, nợ học phí 50 tr.'},
 crisis:{n:'Khủng hoảng',d:'Lãi suất vay cao thêm 3%, cổ phiếu và nhà đất rẻ 30% trong 2 năm đầu.'},
 bubble:{n:'Bong bóng đất',d:'Đất sốt nóng 3 năm đầu rồi đóng băng.'}};
const BOT_LVL={safe:{n:'Thận trọng',coc:.15,useLoan:false,stk:.15,spec:0},normal:{n:'Cân bằng',coc:.1,useLoan:true,stk:.3,spec:.4},risky:{n:'Liều lĩnh',coc:.04,useLoan:true,stk:.5,spec:.8}};
const DREAMS=[{n:'Vòng quanh thế giới',c:3*TY,a:0},{n:'Du thuyền riêng',c:8*TY,a:1},{n:'Thư viện cho quê nhà',c:2*TY,a:2},{n:'Biệt thự bên biển',c:12*TY,a:3},{n:'Quỹ học bổng',c:5*TY,a:4},{n:'Bảo tàng nghệ thuật',c:10*TY,a:5},{n:'Câu lạc bộ bóng đá',c:15*TY,a:6},{n:'Thám hiểm Nam Cực',c:2.5*TY,a:7}];
const CHARS=[{id:'pig',n:'Heo đất'},{id:'cat',n:'Mèo thần tài'},{id:'car',n:'Xe hơi'},{id:'bag',n:'Túi tiền'},{id:'rocket',n:'Tên lửa'},{id:'gem',n:'Kim cương'},{id:'house',n:'Ngôi nhà'},{id:'pawn',n:'Quân cờ'}];
const BOT_NAMES=['Máy Minh','Máy Hoa','Máy Khang','Máy Vy','Máy Phúc','Máy Ngân'];

const BOARD=['salary','doodad','opp','charity','opp','midbonus','opp','market','opp','doodad','opp','downsized','opp','tetbonus','opp','market','opp','doodad','opp','baby','opp','opp','doodad','market'];
const TILE_INFO={
 opp:{lines:['CƠ HỘI'],col:'#2a9f63',desc:'Cơ hội: mua cổ phiếu, trái phiếu, bất động sản, doanh nghiệp.'},
 market:{lines:['THỊ','TRƯỜNG'],col:'#2f78c4',desc:'Thị trường: có người mua lại tài sản, lãi suất hoặc giá thay đổi.'},
 doodad:{lines:['TIÊU','XÀI'],col:'#d24a60',desc:'Tiêu xài: chi tiêu bất ngờ hoặc một lựa chọn trong cuộc sống.'},
 salary:{lines:['LƯƠNG'],col:'#c9952a',desc:'Mốc nhận lương: đầu mỗi lượt (4 tháng) bạn tự động nhận lương và trả chi phí.'},
 midbonus:{lines:['THƯỞNG','GIỮA NĂM'],col:'#d9a53a',desc:'Thưởng giữa năm: đi qua hoặc dừng lại đều nhận thưởng theo kết quả công việc.'},
 tetbonus:{lines:['THƯỞNG','TẾT'],col:'#d6303a',desc:'Thưởng Tết (lương tháng 13): đi qua hoặc dừng lại đều nhận.'},
 charity:{lines:['TỪ','THIỆN'],col:'#8a5bd0',desc:'Từ thiện: góp 10% thu nhập để được chọn tung thêm xúc xắc trong 3 lượt.'},
 baby:{lines:['EM BÉ'],col:'#e57aa8',desc:'Em bé: chi phí nuôi con tăng, nhưng được giảm trừ gia cảnh khi tính thuế.'},
 downsized:{lines:['MẤT','VIỆC'],col:'#5f6d88',desc:'Mất việc: mất lương 1–2 lượt, chỉ nhận trợ cấp thất nghiệp 60%.'}};

const BONDS=[{n:'Điện lực Miền Trung',c:.085,risk:'Thấp',w:1},{n:'Bán lẻ Sao Mai',c:.105,risk:'Trung bình',w:2},{n:'Địa ốc Hưng Phát',c:.13,risk:'Cao',w:5}];
/* Mã chứng khoán Việt Nam. Giá, EPS, cổ tức chỉ là số ước lượng trong game, không phải dữ liệu thị trường. */
const STOCKS={
 VNM:{n:'Vinamilk – sữa và thực phẩm',eps:4300,div:3800,base:65000,vol:.25,news:['Vinamilk ra mắt dòng sữa hạt mới.','Giá sữa bột nguyên liệu giảm, biên lợi nhuận cải thiện.']},
 FPT:{n:'FPT – công nghệ, phần mềm xuất khẩu',eps:5800,div:2000,base:120000,vol:.35,news:['FPT ký hợp đồng chuyển đổi số với đối tác Nhật.','Mảng AI và bán dẫn được kỳ vọng tăng trưởng.']},
 VCB:{n:'Vietcombank – ngân hàng',eps:6000,div:500,base:90000,vol:.25,news:['Nợ xấu được kiểm soát tốt.','Ngân hàng dự kiến tăng vốn điều lệ.']},
 HPG:{n:'Hòa Phát – thép',eps:2000,div:500,base:27000,vol:.45,news:['Giá thép xây dựng tăng theo đầu tư công.','Lò cao mới đi vào hoạt động.']},
 MWG:{n:'Thế Giới Di Động – bán lẻ',eps:2500,div:1000,base:60000,vol:.45,news:['Chuỗi Bách Hóa Xanh báo lãi.','Sức mua điện thoại chững lại.']},
 GAS:{n:'PV Gas – khí đốt',eps:5000,div:3000,base:70000,vol:.25,news:['Giá dầu thế giới tăng.','Kho LNG mới vận hành.']},
 SSI:{n:'Chứng khoán SSI',eps:1500,div:1000,base:30000,vol:.55,news:['Thanh khoản thị trường tăng mạnh.','Khối ngoại quay lại mua ròng.']},
 DBX:{n:'Địa ốc Bến Đông (mã hư cấu, đầu cơ)',eps:300,div:0,base:15000,vol:.9,news:['Tin đồn được rót vốn ngoại.','Dự án chưa có giấy phép xây dựng.']}};
const SYMS=Object.keys(STOCKS);
const GOLD_REF=15*TR;

const FT_BIZ_NAMES=['Chuỗi rửa xe','Chuỗi cà phê','Tiệm giặt sấy','Phòng gym','Chuỗi bánh mì','Vườn sầu riêng','Khách sạn mini','Xưởng in 3D','Bãi đỗ xe','Trung tâm Anh ngữ','Nhà hàng hải sản','Siêu thị mini','Công ty phần mềm','Trạm sạc xe điện','Spa thư giãn','Homestay Đà Lạt','Kho lạnh','Studio podcast','Xưởng nội thất','Phòng khám nha','Điện mặt trời'];
const FT_SIDES=[['cf','biz','biz','dream','biz','lawsuit','biz','biz'],['cf','biz','charity','biz','dream','biz','audit','biz'],['cf','biz','biz','dream','biz','divorce','biz','biz'],['cf','biz','biz','biz','dream','biz','biz','biz']];
const FT=[];(()=>{let b=0,d=0;FT_SIDES.flat().forEach(t=>{if(t==='biz'){const i=b++;const cost=TY+((i*7)%9)*.5*TY;FT.push({t,name:FT_BIZ_NAMES[i],cost,cf:Math.round(cost*(.03+((i*3)%5)*.01)/(10*TR))*10*TR});}else if(t==='dream')FT.push({t,slot:d++});else FT.push({t});});})();
const FT_INFO={cf:{lines:['NGÀY','DÒNG TIỀN'],col:'#23905a',desc:'Ngày dòng tiền: nhận toàn bộ dòng tiền đường đua nhanh.'},biz:{col:'#1c3a68',desc:'Đầu tư doanh nghiệp lớn để tăng dòng tiền.'},dream:{col:'#6c45b5',desc:'Ô giấc mơ: mua được giấc mơ của mình là thắng.'},lawsuit:{lines:['BỊ KIỆN'],col:'#b23c4b',desc:'Bị kiện: mất một nửa tiền mặt.'},audit:{lines:['KIỂM TOÁN','THUẾ'],col:'#b23c4b',desc:'Kiểm toán thuế: mất một nửa tiền mặt.'},divorce:{lines:['LY HÔN'],col:'#8a2535',desc:'Ly hôn: mất toàn bộ tiền mặt.'},charity:{lines:['TỪ','THIỆN'],col:'#8a5bd0',desc:'Từ thiện: góp 1 tỷ để được tung thêm 1 xúc xắc trong 3 lượt.'}};
const ftGoal=()=>mode().ftGoal;

/* ================= state ================= */
let G=null;
const SAVE_KEY='dongtien3d.v4',STATE_V=4;
function save(){try{localStorage.setItem(SAVE_KEY,JSON.stringify(G))}catch(e){}}
function validState(s){return s&&s.v===STATE_V&&Array.isArray(s.players)&&s.players.length&&s.players.every(p=>'living' in p&&'age' in p);}
function sanitize(s){['turn','cur','stockIdx','rateAdj'].forEach(k=>s[k]=num(s[k]));if(!s.stockIdx)s.stockIdx=1;s.cyc=s.cyc||{land:'normal',re:'normal',stock:'normal'};
  s.players.forEach(p=>{['cash','loan','salary','rent','living','childPer','kids','pos','ftPos','ftCF','ftStart','charity','skip','age','dep','cpi','net','parentCare'].forEach(k=>p[k]=num(p[k]));
  p.liabs=(p.liabs||[]).filter(l=>l).map(l=>({...l,bal:num(l.bal),pay:num(l.pay)}));p.assets=(p.assets||[]).filter(a=>a&&(a.type!=='stock'||STOCKS[a.sym]));
  p.assets.forEach(a=>['price','value','loan','pay','left','rent','opex','profit','equity','shares','cost','units','face','coupon','qty','rate','amount','paid','turns'].forEach(k=>{if(k in a)a[k]=num(a[k]);}));
  p.kidAges=(p.kidAges||[]).map(num);p.sides=p.sides||[];p.risk=num(p.risk);p.schoolPrem=num(p.schoolPrem);p.ach=p.ach||{};p.deals=p.deals||[];p.events=p.events||[];});return s;}
function loadSaved(){try{const s=JSON.parse(localStorage.getItem(SAVE_KEY)||'null');return validState(s)?sanitize(s):null}catch(e){return null}}
const curP=()=>G.players[G.cur];
const isBotTurn=()=>!!(G&&G.players&&curP()&&curP().bot);

function assetCF(a){
  if(a.type==='re')return a.rent*(1-a.opex)-(a.left>0?a.pay:0);
  if(a.type==='biz')return a.profit-(a.left>0?a.pay:0);
  if(a.type==='stock')return a.shares*STOCKS[a.sym].div*(1-DIV_TAX)/12;
  if(a.type==='bond')return a.def?0:a.units*a.face*a.coupon*(1-BOND_TAX)/12;
  return 0;
}
function assetValue(a){
  if(a.type==='stock')return a.shares*STOCKS[a.sym].base*(G&&G.stockIdx||1);
  if(a.type==='bond')return a.units*a.face;
  if(a.type==='gold')return a.qty*GOLD_REF;
  if(a.type==='scam')return a.amount;
  if(a.type==='crypto')return a.qty*btcPrice();
  return num(a.value||a.price);
}
function kidCost(p,age){if(age>=22)return 0;let c=p.childPer;if(mode().life){if(age>=18)c+=5*TR*p.cpi;else if(age>=6)c+=1.5*TR*p.cpi;}return c;}
function calc(p,o={}){
  let passive=0,rentGross=0;for(const a of p.assets){passive+=num(assetCF(a));if(a.type==='re'&&a.kind!=='land')rentGross+=a.rent;}
  const rentTax=rentGross*12>RENT_TAX_TH?rentGross*RENT_TAX:0;
  const depInt=p.dep*DEP_RATE/12;passive+=depInt-rentTax;
  const kidsIn=p.kidAges.filter(k=>k<22);
  const sal=o.noSalary?p.salary*(o.benefit||0):p.salary;
  const {ins,tax}=netSalary(sal,kidsIn.length);
  const sp=p.spouse?netSalary(p.spouse,0):null,spouseNet=p.spouse?p.spouse-sp.ins-sp.tax:0;
  const liabPay=p.liabs.reduce((s,l)=>s+num(l.pay),0);
  const childExp=kidsIn.reduce((s,k)=>s+kidCost(p,k),0), loanPay=Math.round(p.loan*clr());
  const insPrem=p.hins?Math.round(p.salary*.015/1e4)*1e4:0;
  const totalExp=ins+tax+p.rent+p.living+liabPay+childExp+loanPay+insPrem+p.parentCare;
  const side=(o.noSalary?0:1)*p.sides.reduce((s,x)=>s+x.inc,0);
  const income=sal+spouseNet+passive+side;
  return {passive,income,totalExp:totalExp+p.schoolPrem,cashflow:income-totalExp-p.schoolPrem,childExp,loanPay,liabPay,ins,tax,rentTax,depInt,spouseNet,insPrem,sal,side};
}
const TIERS={1:{n:'Cơm áo gạo tiền',d:'Làm thêm, kinh doanh nhỏ, phòng trọ, cổ phiếu, vàng, Bitcoin'},2:{n:'Tích lũy',d:'Mở khóa đầu tư lớn: chung cư, nhà đất, chuỗi cà phê, siêu thị mini, farm, góp vốn công ty'},3:{n:'Nhà đầu tư',d:'Mở khóa nhà phố, căn hộ dịch vụ, khách sạn mini, mua lại công ty'}};
const TIER_NW={2:500*TR,3:3*TY};
function investCap(p){let v=p.cash+p.dep;for(const a of p.assets)v+=assetValue(a)-num(a.loan);return v-p.loan;}
function tier(p){const nw=investCap(p);return nw>=TIER_NW[3]?3:nw>=TIER_NW[2]?2:1;}
const btcPrice=()=>Math.round(2*TY*(G&&G.btcIdx||1)/1e6)*1e6;
function netWorth(p){let v=p.cash+p.dep;for(const a of p.assets)v+=assetValue(a)-num(a.loan);v-=p.loan;for(const l of p.liabs)v-=l.bal;return v;}
function newPlayer(i,d,prof,name,scen){
  const p={id:i,name,color:COLORS[i],char:d.char,bot:!!d.bot,botLvl:d.botLvl||'normal',prof:prof.n,age:prof.age,salary:T(prof.sal),rent:T(prof.rent),living:T(prof.liv),childPer:T(prof.ch),kids:0,kidAges:[],liabs:[],loan:0,cash:0,dep:0,assets:[],
    pos:0,ft:false,ftPos:0,ftCF:0,ftStart:0,ftAssets:[],dream:d.dream,charity:0,skip:0,hist:[],won:false,out:false,retired:false,spouse:0,parentCare:0,hins:false,cpi:1,net:0,ach:{},deals:[],events:[],sides:[],risk:0,schoolPrem:0};
  for(const k in prof.L){const [b,pay]=prof.L[k];p.liabs.push({key:k,label:LIAB_LABEL[k],bal:T(b),pay:T(pay)});}
  let sav=T(prof.sav);
  if(scen==='grad'){p.age=22;sav=5*TR;p.liabs.push({key:'study',label:'Vay học phí đại học',bal:50*TR,pay:1*TR});}
  p.cash=sav+calc(p).cashflow;
  p.hist.push(snapHist(p));
  return p;
}
function snapHist(p){const c=calc(p);return {passive:p.ft?p.ftCF:c.passive,exp:p.ft?p.ftStart+ftGoal():c.totalExp,nw:netWorth(p),age:p.age};}
function log(text,p){G.log.unshift({t:G.turn,who:p?p.name:'',c:p?p.color:'',text});if(G.log.length>300)G.log.length=300;}
const loanCap=p=>Math.max(p.salary,20*TR)*15;

function needLoan(p,amt){return p.ft?0:Math.max(0,Math.ceil((amt-p.cash)/CL_STEP)*CL_STEP);}
function pay(p,amt,why){
  amt=num(amt);if(amt<=0)return;
  if(!p.ft&&p.cash<amt&&p.loan+needLoan(p,amt)>loanCap(p))liquidate(p,amt);
  if(!p.ft&&p.cash<amt&&p.dep>0){const w=Math.min(p.dep,amt-p.cash);p.dep-=w;p.cash+=w;}
  const need=needLoan(p,amt);
  if(need){p.loan+=need;p.cash+=need;p.st=p.st||{};p.st.loanMax=Math.max(p.st.loanMax||0,p.loan);toast(`${p.name} vay tiêu dùng tự động ${fmt(need)} (lãi ${fmt(need*clr())}/tháng)`,'neg');log(`Vay tiêu dùng ${fmt(need)} để trả: ${why}`,p);}
  p.cash-=amt;sfx('pay');
}
function liquidate(p,amt){
  const list=p.assets.slice().sort((a,b)=>assetCF(a)-assetCF(b));
  for(const a of list){if(p.cash+p.dep+Math.max(0,loanCap(p)-p.loan)>=amt)break;
    const v=Math.max(0,a.type==='scam'?0:a.type==='re'||a.type==='biz'?(assetValue(a)-a.loan)*.5:assetValue(a)*.5);
    p.assets.splice(p.assets.indexOf(a),1);p.cash+=v;p.deals.push({name:'Thanh lý gấp '+(a.name||a.type),pl:v-(a.equity||a.cost||0)});toast(`${p.name} thanh lý gấp ${assetLabel(a)}: chỉ thu ${fmt(v)}`,'neg');log(`Thanh lý gấp ${assetLabel(a)} được ${fmt(v)} (50% giá trị) vì hết hạn mức vay`,p);}
  if(p.cash+p.dep+Math.max(0,loanCap(p)-p.loan)<amt){
    p.bankrupt=(p.bankrupt||0)+1;p.skip=Math.max(p.skip,2);
    p.liabs.forEach(l=>{if(l.key!=='home'){l.bal=Math.round(l.bal/2);l.pay=Math.round(l.pay/2);}});
    toast(`${p.name} PHÁ SẢN: mất 2 lượt, nợ cá nhân được tái cơ cấu còn một nửa`,'neg');log('Phá sản: hết tài sản, vượt hạn mức vay. Mất 2 lượt, nợ cá nhân giảm một nửa.',p);}
}
function gain(p,amt){p.cash+=num(amt);if(amt>0)sfx('cash');}
function amortize(p){for(const a of p.assets){if(a.loan>0&&a.left>0){const int=a.loan*a.rate/12;a.loan=Math.max(0,a.loan-(a.pay-int));a.left--;
  if(a.teaserLeft>0){a.teaserLeft--;if(!a.teaserLeft){const old=a.pay;a.rate=a.floatRate+(G.rateAdj||0);a.pay=pmt(a.loan,a.rate,a.left/12);p.events.push({k:'teaser',name:a.name,old,pay:a.pay,rate:a.rate});}}
  if(a.left<=0||a.loan<1){a.loan=0;a.left=0;a.pay=0;}}}}

/* ================= dòng thời gian: mỗi lượt 4 tháng ================= */
function advanceTurn(p){
  if(p.ft||p.out)return null;
  const before=p.cash,unemp=p.skip>0;
  for(let m=0;m<mpt();m++){amortize(p);const cf=calc(p,{noSalary:unemp,benefit:unemp&&p.benefitLeft>0?mode().benefit:0}).cashflow;if(cf>=0)p.cash+=cf;else pay(p,-cf,'chi phí sinh hoạt');}
  if(unemp&&p.benefitLeft>0)p.benefitLeft--;
  p.assets.filter(a=>a.type==='scam').forEach(a=>{if(a.turns>0){const g=a.amount*a.promise*mpt();p.cash+=g;a.paid+=g;a.turns--;}else{p.assets.splice(p.assets.indexOf(a),1);p.deals.push({name:a.name,pl:a.paid-a.amount});p.events.push({k:'scamcrash',name:a.name,lost:a.amount-a.paid});log(`${a.name} sập, mất ${fmt(a.amount-a.paid)}`,p);}});
  const y0=Math.floor(p.age);p.age+=mpt()/12;if(Math.floor(p.age)>y0)yearTick(p);
  return {delta:p.cash-before,unemp};
}
function yearTick(p){
  const M=mode();const t=tier(p);if(t>(p.tierMax||1)){p.tierMax=t;p.events.push({k:'tierup',t});}
  if(M.infl){const k=1+M.infl;p.living*=k;p.rent*=k;p.childPer*=k;p.cpi*=k;p.parentCare*=k;}
  p.kidAges=p.kidAges.map(a=>a+1);
  p.kidAges.forEach(a=>{if(M.life&&a===6)p.events.push({k:'kidschool'});if(M.life&&a===18)p.events.push({k:'kiduni'});if(a===22)p.events.push({k:'kidgrown'});});
  p.kidAges=p.kidAges.filter(a=>a<=22);p.kids=p.kidAges.filter(a=>a<22).length;
  if(!p.retired&&p.skip<=0){let r=rf(M.raise[0],M.raise[1]);if(M.promo&&Math.random()<M.promo){r+=.2;p.events.push({k:'promo'});}p.salary=Math.round(p.salary*(1+r)/1e5)*1e5;p.lastRaise=r;}
  if(p.spouse)p.spouse=Math.round(p.spouse*(1+M.raise[0]+.02)/1e5)*1e5;
  if(M.retire&&!p.ft){if(p.age>=60&&!p.retired){p.retired=true;p.salary=Math.round(p.salary*.55/1e5)*1e5;p.events.push({k:'retire'});}if(p.age>=70&&!p.out){p.out=true;p.events.push({k:'retireout'});}}
  if(!p.spouse&&!p.single&&p.age>=24&&p.age<=36&&Math.random()<(M.life?.3:.2))p.events.push({k:'marry'});
  if(M.life&&!p.parentCare&&p.age>=36&&Math.random()<.15)p.events.push({k:'parents'});
}
/* năm mới chung cho cả bàn: chu kỳ thị trường, lãi suất */
const CYC={land:{boom:.25,normal:.06,bust:-.15},re:{boom:.12,normal:.04,bust:-.06},stock:{boom:.25,normal:.06,bust:-.22}};
const CYC_LABEL={boom:'Sốt nóng',normal:'Ổn định',bust:'Đóng băng'};
function newYear(){
  const M=mode(),yr=yearOf(),news=[];
  const step=k=>{const c=G.cyc[k],r=Math.random();G.cyc[k]=c==='boom'?(r<.45?'bust':r<.8?'normal':'boom'):c==='bust'?(r<.5?'normal':r<.7?'boom':'bust'):(r<.2?'boom':r<.35?'bust':'normal');};
  if(M.news){['land','re','stock'].forEach(step);
    if(G.scenario==='bubble'){const y=yr-START_YEAR;G.cyc.land=y<=3?'boom':y<=5?'bust':G.cyc.land;}
    const d=pick([-.01,0,0,0,.01,.015]);G.rateAdj=clamp((G.rateAdj||0)+d,-.02,.05);
    if(d)G.players.forEach(p=>p.assets.forEach(a=>{if(a.loan>0&&a.left>0&&!(a.teaserLeft>0)){a.rate=Math.max(.04,a.rate+d);a.pay=pmt(a.loan,a.rate,a.left/12);}}));
    if(d)news.push(d>0?`Lãi suất cho vay tăng ${pct(d)}/năm. Khoản vay thả nổi phải trả góp nhiều hơn.`:`Lãi suất giảm ${pct(-d)}/năm. Trả góp nhẹ hơn.`);}
  else{G.cyc={land:'normal',re:'normal',stock:'normal'};}
  G.stockIdx=clamp((G.stockIdx||1)*(1+CYC.stock[G.cyc.stock]),.4,3);
  G.btcIdx=clamp((G.btcIdx||1)*pick([.45,.6,.8,1,1.2,1.5,1.9,2.4]),.1,20);news.push(`Bitcoin: khoảng ${fmt(btcPrice())}/BTC.`);
  G.players.forEach(p=>p.assets.forEach(a=>{if(a.type==='re'||a.type==='biz'){const g=a.type==='biz'?.02:a.kind==='land'?CYC.land[G.cyc.land]:CYC.re[G.cyc.re];a.value=Math.max(a.price*.3,(a.value||a.price)*(1+g));}}));
  if(M.bizRisk)G.players.forEach(p=>p.assets.forEach(a=>{if(a.type==='biz'&&a.kind!=='startup'){const base=a.profit0||(a.profit0=a.profit);let f=rf(.75,1.2);if(Math.random()<.06){f=.2;p.events.push({k:'bizbad',name:a.name});}a.profit=Math.round(clamp(a.profit*f,base*.3,base*1.5)/1e5)*1e5;}}));
  news.unshift(`Đất nền: ${CYC_LABEL[G.cyc.land]}. Nhà ở và căn hộ: ${CYC_LABEL[G.cyc.re]}. Chứng khoán: ${CYC_LABEL[G.cyc.stock]}.`);
  if(M.infl)news.push(`Lạm phát ${pct(M.infl)}: sinh hoạt phí, tiền nhà, chi phí nuôi con tăng theo.`);
  G.news={year:yr,lines:news};
}

/* ================= bots & phân tích ================= */
function analyze(a,ltv){
  const loan=round1(a.price*ltv),fees=a.type==='re'?a.price*FEE_BUY_RE:0,equity=a.price-loan+fees;
  const rate=a.teaser?a.teaser.rate:a.rate,pmtM=pmt(loan,rate,a.term);
  const net=a.type==='re'?a.rent*(1-a.opex):a.profit;
  const cf=net-pmtM,coc=equity?cf*12/equity:0;
  const pmtAfter=a.teaser?pmt(loan*.95,a.floatRate+(G&&G.rateAdj||0),a.term-a.teaser.months/12):pmtM;
  return {loan,fees,equity,pmtM,net,cf,coc,gy:a.type==='re'&&a.price?a.rent*12/a.price:0,pmtAfter,cfAfter:net-pmtAfter};
}
function botPick(p,d){const L=BOT_LVL[p.botLvl||'normal'];const a=d.a;let best=null;
  for(const x of d.ltvs){const R=analyze(a,x),Ln=needLoan(p,R.equity);if(p.loan+Ln>loanCap(p))continue;if(Ln&&!L.useLoan)continue;const real=Math.min(R.cf,R.cfAfter)-Ln*clr(),coc=R.equity?real*12/R.equity:0;
    if(a.kind==='land'||a.kind==='startup'){if(p.cash>R.equity*3&&Math.random()<L.spec)best={x,real:0};continue;}
    if(real>0&&coc>=L.coc&&(!best||real>best.real))best={x,real};}
  return best?best.x:null;}
function botHousekeeping(p){
  if(p.ft)return;const c=calc(p),cushion=c.totalExp*(mode().life?6:3);
  while(p.loan>=CL_STEP&&p.cash-CL_STEP>c.totalExp*2){p.loan-=CL_STEP;p.cash-=CL_STEP;}
  p.liabs.slice().sort((a,b)=>b.pay/b.bal-a.pay/a.bal).forEach(l=>{if(p.cash-l.bal>cushion*1.5){p.cash-=l.bal;p.liabs.splice(p.liabs.indexOf(l),1);}});
  if(mode().insurance&&!p.hins&&p.cash>c.totalExp*3)p.hins=true;
}
function botWantsSell(q,a,net,basis){if(!q.bot||net<=0)return false;const g=basis>0?(net-basis)/basis:1;return g>=.3||(assetCF(a)<0&&g>=0);}

/* ================= decks ================= */
function stockPrice(sym){const S=STOCKS[sym];const m=pick([.55,.7,.8,.9,1,1,1.1,1.2,1.35,1.6]);const mult=Math.max(.2,1+(m-1)*S.vol/.35);return Math.max(1000,Math.round(S.base*(G&&G.stockIdx||1)*mult/100)*100);}
function stockCard(){const sym=pick(SYMS),S=STOCKS[sym],price=stockPrice(sym),ref=S.base*(G&&G.stockIdx||1);
  return {k:'stock',sym,price,ref,title:`${sym} · ${fmtD(price)}/cp`,story:`${pick(S.news)} ${cap(who())} nhắn bạn: "Mã ${sym} đang ${price<ref?'rẻ, gom dần đi':'chạy mạnh, vào nhanh kẻo lỡ'}!"`};}
const cap=s=>s[0].toUpperCase()+s.slice(1);
function re(title,text,kind,price,rent,opex,term,o={}){rent=Math.round(rent*mode().rMul/1e5)*1e5;const rate=Math.round((rf(.085,.105)+(G&&G.rateAdj||0))*1000)/1000;
  const a={type:'re',kind,name:title,units:o.units||1,price,value:price,rent,opex,rate,term};
  if(o.teaser&&mode().teaser){a.teaser={rate:.065,months:24};a.floatRate=Math.round(rf(.115,.125)*1000)/1000;}
  return {k:'prop',title,text,art:o.art,label:o.label,a,ltvs:kind==='land'?[0,.5]:[0,.5,.7]};}
function biz(title,text,kind,price,profit,ltvs,term,rate,o={}){profit=Math.round(profit*(kind==='small'?mode().sMul:mode().yMul)/1e5)*1e5;return {k:'prop',title,text,art:o.art,a:{type:'biz',kind,name:title,price,value:price,profit,rate:(rate||.11)+(G&&G.rateAdj||0),term},ltvs};}
function drawSmallRaw(){
  const r=Math.random(),M=mode();
  if(M.scam&&r<.05)return pick([{k:'scam',name:'Sàn tiền ảo VinaCoin',promise:.05,title:'Sàn tiền ảo lãi 5%/tháng',text:`${cap(who())} khoe ảnh chụp tài khoản lãi đều mỗi tháng, rủ bạn "vào sớm kẻo hết suất". Sàn không có giấy phép.`},
    {k:'scam',name:'Dự án nông nghiệp đa cấp',promise:.04,title:'Góp vốn trồng sâm, cam kết lãi 4%/tháng',text:'Hội thảo ở khách sạn 5 sao, diễn giả hứa "càng giới thiệu nhiều người càng giàu". Hợp đồng không ghi rõ ai chịu rủi ro.'}]);
  if(r<.12&&p0()&&p0().sides.length<2){const S=pick([['Chạy xe công nghệ buổi tối',rnd(25,40)*1e5,'Mỗi tối chạy 3 tiếng, cuối tuần chạy cả ngày.','scooter'],['Dạy kèm tiếng Anh',rnd(20,35)*1e5,'Hai học sinh lớp 9 ôn thi vào 10, dạy 4 buổi/tuần.','school'],['Bán hàng online cuối tuần',rnd(15,40)*1e5,'Nhập quần áo ở chợ đầu mối, livestream bán tối thứ Bảy.','shopping'],['Viết bài, thiết kế tự do',rnd(20,50)*1e5,'Nhận việc qua các nền tảng freelance.','startup']]);
    return {k:'side',name:S[0],inc:S[1],title:`Làm thêm: ${S[0]}`,text:S[2],art:S[3]};}
  if(r<.17)return {k:'crypto',price:btcPrice(),title:`Bitcoin ${fmt(btcPrice())}/BTC`,text:`${cap(who())} khoe ví tiền số lãi gấp đôi trong 3 tháng. Giá Bitcoin biến động rất mạnh: có năm tăng gấp đôi, có năm mất một nửa. Không tạo dòng tiền.`};
  if(r<.3)return stockCard();
  if(r<.35){const x=Math.random();
    if(x<.3)return {k:'delist',sym:'DBX',title:'DBX bị hủy niêm yết',text:'Công ty Địa ốc Bến Đông (mã hư cấu) vi phạm công bố thông tin nhiều năm. Cổ phiếu DBX mất toàn bộ giá trị.',art:'chartdown'};
    const sym=pick(SYMS.filter(s=>s!=='DBX')),ratio=x<.65?.2:.3;return {k:'sdiv',sym,ratio,title:`${sym} chia cổ tức bằng cổ phiếu ${pct(ratio,0)}`,text:`Đại hội cổ đông ${STOCKS[sym].n.split(' –')[0]} thông qua chia thưởng. Cổ đông nhận thêm ${pct(ratio,0)} số cổ phiếu (làm tròn xuống), giá vốn mỗi cổ phiếu giảm tương ứng.`,art:'chartup'};}
  if(r<.43){const b=pick(BONDS);return {k:'bond',b,title:`Trái phiếu ${b.n}`,story:`Nhân viên ngân hàng mời ${b.risk==='Cao'?'nhiệt tình, hứa "chắc chắn an toàn như gửi tiết kiệm"':'kèm bản cáo bạch đầy đủ'}.`};}
  if(r<.5){const each=rnd(130,170)*1e5;return {k:'gold',each,title:`Vàng nhẫn ${fmt(each)}/chỉ`,text:`Tiệm vàng quen bán vàng nhẫn 9999. ${pick(['Mẹ bạn khuyên "có vàng là có của để dành".','Giá vàng thế giới đang đi ngang.','Hàng xóm vừa xếp hàng từ sáng mua 2 chỉ.'])} Vàng không tạo dòng tiền, chỉ lời khi giá lên.`};}
  if(r<.68){const t=Math.random();
    if(t<.4){const loc=pick(['gần KCN VSIP Bình Dương','gần ĐH Bách khoa Hà Nội','Bình Thạnh, TP.HCM','gần KCN Bắc Thăng Long','làng đại học Thủ Đức']);const price=rnd(18,26)*10*TR,rent=Math.round(price*rf(.085,.11)/12/1e5)*1e5;
      return re(`Phòng trọ ${loc}`,`Mua lại 1 phòng trong dãy trọ ${rnd(10,20)} phòng. ${who()} là chủ dãy, quản lý giúp với phí 8%. ${pick(SELLER)}`,'room',price,rent,.08+.05,10,{art:'boarding',label:loc.toUpperCase().slice(0,26)});}
    if(t<.75){const loc=pick(['chợ Hà Đông','chợ Thủ Đức','chợ Long Biên','chợ đầu mối Bình Điền','chợ Hàn, Đà Nẵng']);const price=rnd(25,40)*10*TR,rent=Math.round(price*rf(.085,.115)/12/1e5)*1e5;
      return re(`Ki-ốt ${loc}`,`Ki-ốt 6 m², khách thuê bán quần áo đã ký hợp đồng 3 năm. ${pick(SELLER)}`,'room',price,rent,.05+.03,10,{art:'kiosk',label:loc.toUpperCase()});}
    const loc=pick(['Long An','Hòa Lạc, Hà Nội','Bình Phước','Nhơn Trạch, Đồng Nai']);const price=rnd(40,70)*10*TR;
    return re(`Đất nền ${loc} 100 m²`,`Đất nền đã có sổ, hạ tầng đang làm. ${who()} môi giới nói "sắp có đường lớn chạy qua". Không có tiền thuê, chỉ lời khi bán được giá cao.`,'land',price,0,0,10,{art:'land',label:loc});}
  if(r<.92){const t=pick([
      ['Máy bán nước tự động','Hệ thống 4 máy đặt tại trường THPT và 2 tòa văn phòng. Gần như không cần quản lý, chỉ châm hàng mỗi tuần.',rnd(20,40)*TR,[.035,.05],'vending'],
      ['Xe cà phê cổng KCN Tân Tạo','Xe cà phê mang đi, bán sáng sớm cho công nhân ca 1. Thuê một bạn sinh viên đứng bán.',rnd(30,50)*TR,[.03,.06],'coffeecart'],
      ['Góp vốn tiệm nail','Góp 30% vốn tiệm nail của '+pick(NAMES)+', khách quen đông vào cuối tuần. Chia lợi nhuận hằng tháng.',rnd(5,10)*10*TR,[.025,.04],'nail'],
      ['Cho thuê xe máy ở phố cổ Hội An','5 xe số cho khách du lịch thuê theo ngày. Mùa mưa khách vắng.',rnd(8,12)*10*TR,[.03,.045],'bikerent'],
      ['Quán cà phê cóc vỉa hè','Quán nhỏ đầu ngõ, bán cà phê muối và trà chanh cho dân văn phòng.',rnd(6,12)*10*TR,[.03,.05],'cafe'],
      ['Tiệm giặt là nhỏ','3 máy giặt, nhận giặt cho khu trọ công nhân.',rnd(8,15)*10*TR,[.025,.04],'laundry'],
      ['Bán hàng online trên sàn TMĐT','Gian hàng phụ kiện điện thoại đang có 2.000 đơn/tháng, chủ cũ đi du học nên sang lại.',rnd(15,30)*TR,[.03,.06],'shopping']]);
    return biz(t[0],t[1],'small',t[2],Math.round(t[2]*rf(...t[3])/1e5)*1e5,[0],10,0,{art:t[4]});}
  if(r<.96)return biz('Cổ phần startup giao đồ ăn','Ba bạn trẻ vừa tốt nghiệp gọi vốn cho ứng dụng giao cơm văn phòng. Chưa có lợi nhuận, rủi ro mất trắng, nhưng có thể được tập đoàn lớn mua lại.','startup',50*TR,0,[0],0,0,{art:'startup'});
  return re('Đất vườn ven đô 300 m²','Đất trồng cây lâu năm, chưa lên thổ cư.','land',rnd(40,70)*10*TR,0,0,10,{art:'land',label:'Ven đô'});
}
const APTS=[
 {n:'Căn hộ 2PN Vinhomes Smart City',loc:'Tây Mỗ, Hà Nội',lab:'VINHOMES SMART CITY',p:[36,46],r:[12,15]},
 {n:'Căn hộ studio Vinhomes Ocean Park',loc:'Gia Lâm, Hà Nội',lab:'VINHOMES OCEAN PARK',p:[17,22],r:[6.5,8]},
 {n:'Căn hộ 1PN+ Vinhomes Grand Park',loc:'TP Thủ Đức',lab:'VINHOMES GRAND PARK',p:[24,29],r:[8,10]},
 {n:'Căn hộ 2PN Masteri Thảo Điền',loc:'TP Thủ Đức',lab:'MASTERI THẢO ĐIỀN',p:[70,90],r:[22,28]},
 {n:'Căn hộ 2PN Ecopark',loc:'Văn Giang, Hưng Yên',lab:'ECOPARK',p:[25,32],r:[8,10]},
 {n:'Căn hộ 2PN Times City',loc:'Hai Bà Trưng, Hà Nội',lab:'TIMES CITY',p:[50,62],r:[15,18]}];
function drawBigRaw(){
  const tr=p0()?tier(p0()):2;
  if(tr>=3&&Math.random()<.35){const t=pick([
      ['Khách sạn mini 20 phòng ở Nha Trang','Khách sạn đang chạy ổn, khách Hàn và Nga. Mùa thấp điểm vắng khách.',rnd(80,150)*100*TR,[.012,.02],'serviced'],
      ['Mua lại công ty phần mềm 30 người','Công ty gia công phần mềm cho Nhật, nhà sáng lập muốn nghỉ hưu.',rnd(50,100)*100*TR,[.014,.022],'startup'],
      ['Xưởng sản xuất bao bì','Khách hàng là các nhà máy thực phẩm, hợp đồng dài hạn.',rnd(60,120)*100*TR,[.012,.02],'garment']]);
    return biz(t[0],t[1],'big',t[2],Math.round(t[2]*rf(...t[3])/1e6)*1e6,[0,.3,.5],10,.105,{art:t[4]});}
  const r=tr>=3?Math.random():(Math.random()<.4?Math.random()*.4:.6+Math.random()*.4);
  if(r<.2){const n=rnd(8,16),rent=rnd(25,35)*1e5,y=rf(.095,.13),price=Math.round(n*rent*12/y/(10*TR))*10*TR;const loc=pick(['gần ĐH Quốc gia TP.HCM','Cầu Giấy, Hà Nội','gần KCN Yên Phong, Bắc Ninh','Dĩ An, Bình Dương']);
    return re(`Dãy trọ ${n} phòng ${loc}`,`Dãy trọ lấp đầy 90%, khách chủ yếu là sinh viên và công nhân. ${pick(SELLER)} Bạn phải tự lo thu tiền, sửa điện nước.`,'room',price,n*rent,.06+.06,20,{units:n,art:'boarding',label:`DÃY TRỌ ${n} PHÒNG`});}
  if(r<.4){const A=pick(APTS);const price=rnd(A.p[0],A.p[1])*100*TR,rent=round1(rf(A.r[0],A.r[1])*TR);
    return re(A.n,`Dự án ở ${A.loc}. ${pick(['Chủ nhà là Việt kiều, sang lại cả nội thất.','Căn góc, view hồ, khách thuê là chuyên gia Hàn Quốc.','Chủ cũ muốn thoát hàng vì hết thời gian ưu đãi lãi suất.','Sàn môi giới nói "giá đang lên, tuần sau tăng 5%".'])} Lợi suất cho thuê căn hộ ở Việt Nam thường chỉ 4–5%/năm.`,'apt',price,rent,.04+.04,20,{art:'tower',label:A.lab,teaser:true});}
  if(r<.5){const st=pick(['phố Bạch Mai, Hà Nội','đường Nguyễn Trãi, Quận 5','đường Phan Xích Long, Phú Nhuận','phố Chùa Bộc, Đống Đa']);const rent=rnd(25,60)*TR,y=rf(.04,.06),price=Math.round(rent*12/y/(100*TR))*100*TR;
    return re(`Nhà phố mặt tiền ${st}`,`Nhà 4 tầng, khách thuê là chuỗi cửa hàng thời trang. Giá rất cao so với tiền thuê, chủ yếu kỳ vọng tăng giá.`,'shop',price,rent,.02,20,{art:'shophouse',label:st.toUpperCase()});}
  if(r<.6){const n=rnd(10,16),rent=rnd(6,9)*TR,y=rf(.1,.125),price=Math.round(n*rent*12/y/(100*TR))*100*TR;const loc=pick(['Quận 3, TP.HCM','Ba Đình, Hà Nội','Sơn Trà, Đà Nẵng']);
    return re(`Căn hộ dịch vụ ${n} phòng ${loc}`,`Tòa căn hộ dịch vụ cho người nước ngoài thuê theo tháng. Phí vận hành cao (dọn phòng, lễ tân).`,'room',price,n*rent,.15+.08,20,{units:n,art:'serviced',label:'SERVICED APARTMENT'});}
  if(r<.93){const t=pick([
      ['Quán cà phê sân vườn ở Đà Lạt','Quán đang đông khách du lịch. '+pick(NAMES)+' muốn sang lại để về quê chăm mẹ. Doanh thu giảm mạnh mùa mưa.',rnd(4,9)*100*TR,[.024,.036],'cafe'],
      ['Tiệm giặt sấy gần ký túc xá ĐHQG','10 máy giặt công nghiệp, sinh viên xếp hàng mỗi tối Chủ nhật.',rnd(3,7)*100*TR,[.022,.032],'laundry'],
      ['Cửa hàng trà sữa nhượng quyền','Thương hiệu đang lên. Cạnh tranh rất cao, cùng phố đã có 4 tiệm trà sữa.',rnd(6,10)*100*TR,[.008,.038],'milktea'],
      ['Chuỗi 3 quán cà phê ở TP.HCM','Chuỗi đang có thương hiệu riêng, cần người góp vốn mở rộng. Quản lý chuyên nghiệp.',rnd(20,30)*100*TR,[.016,.026],'cafe'],
      ['Siêu thị mini khu chung cư','Cửa hàng tiện lợi 24/7 dưới chân tòa nhà 2.000 hộ dân.',rnd(15,25)*100*TR,[.015,.024],'kiosk'],
      ['Trang trại sầu riêng ở Đắk Lắk','5 ha sầu riêng đang cho trái, xuất khẩu Trung Quốc. Phụ thuộc thời tiết và giá thu mua.',rnd(30,45)*100*TR,[.012,.026],'land'],
      ['Góp vốn công ty thiết kế nội thất','Góp 20% vốn công ty 15 nhân viên của '+pick(NAMES)+', chia cổ tức hằng tháng.',rnd(5,15)*100*TR,[.015,.025],'opp'],
      ['Phòng gym khu đô thị Linh Đàm','400 hội viên, hợp đồng thuê mặt bằng 5 năm.',rnd(15,25)*100*TR,[.018,.026],'gym'],
      ['Xưởng may gia công ở Bình Dương','Đơn hàng xuất khẩu đi Mỹ ổn định, 40 công nhân.',rnd(25,40)*100*TR,[.016,.024],'garment']]);
    return biz(t[0],t[1],'big',t[2],Math.round(t[2]*rf(...t[3])/1e6)*1e6,[0,.3,.5],7,.11,{art:t[4]});}
  return re('Lô đất 500 m² gần sân bay Long Thành','Đất thổ cư mặt đường, giá đã tăng mạnh nhiều năm qua. Không có dòng tiền.','land',rnd(20,50)*100*TR,0,0,15,{art:'land',label:'Long Thành, Đồng Nai'});
}
function bestCoc(d){if(d.k!=='prop')return 1;return Math.max(...d.ltvs.map(x=>analyze(d.a,x).coc));}
function drawDeal(big){let d=big?drawBigRaw():drawSmallRaw();const gb=mode().goodBias;if(gb&&d.k==='prop'&&bestCoc(d)<.12&&Math.random()<gb)d=big?drawBigRaw():drawSmallRaw();if(gb&&d.k==='scam')d=drawSmallRaw();return d;}
const drawSmall=()=>drawDeal(false),drawBig=()=>drawDeal(true);
const RE_GROUP={room:'phòng trọ, ki-ốt, căn hộ dịch vụ',apt:'căn hộ chung cư',shop:'nhà phố',land:'đất nền'};
function drawMarket(){
  const opts=[
    ()=>{const g=pick(['room','apt','shop']),m=Math.round(rf(g==='shop'?1:.95,g==='shop'?1.5:1.35)*100)/100;return {art:'buyer',title:`Thu mua ${RE_GROUP[g]} giá ×${trimNum(m,2)}`,text:`${cap(who())} vừa bán đất ở quê, muốn mua ${RE_GROUP[g]} với giá bằng ${trimNum(m,2)} lần giá thị trường hiện tại. Người bán chịu thuế 2% và tất toán khoản vay còn lại.`,match:a=>a.type==='re'&&a.kind===g,price:a=>round1(assetValue(a)*m)};},
    ()=>{const m=Math.round(rf(1.4,2.2)*10)/10;return {art:'landfever',title:`Sốt đất: đất nền giá ×${trimNum(m,1)}`,text:`Có tin ${pick(['cao tốc mới sắp thông xe','tỉnh sắp lên thành phố','sân bay sắp mở rộng'])}. Giới đầu cơ đổ về, xe ô tô đậu kín đường làng.`,match:a=>a.type==='re'&&a.kind==='land',price:a=>round1(assetValue(a)*m)};},
    ()=>{const m=Math.round(rf(.6,.8)*100)/100;return {art:'landfreeze',title:`Đất nền đóng băng: chỉ còn ×${trimNum(m,2)}`,text:'Ngân hàng siết tín dụng bất động sản. Môi giới đất biến mất, ai cần tiền phải bán cắt lỗ.',match:a=>a.type==='re'&&a.kind==='land',price:a=>round1(assetValue(a)*m)};},
    ()=>{const m=Math.round(rf(1.3,2.5)*10)/10;return {art:'buyer',title:`Quỹ đầu tư mua doanh nghiệp ×${trimNum(m,1)}`,text:`Một quỹ ngoại muốn gom các mô hình kinh doanh đang có lãi, trả gấp ${trimNum(m,1)} lần tổng vốn ban đầu.`,match:a=>a.type==='biz'&&(a.kind==='big'||a.kind==='small'),price:a=>round1(a.price*m)};},
    ()=>({art:'startup',title:'Startup giao đồ ăn được mua lại',text:'Một siêu ứng dụng mua lại startup giao cơm văn phòng, trả gấp 12 lần vốn góp.',match:a=>a.type==='biz'&&a.kind==='startup',price:a=>a.price*12}),
    ()=>{const each=rnd(120,200)*1e5;return {art:'gold',title:`Giá vàng ${fmt(each)}/chỉ`,text:`Giá vàng ${each>=150e5?'lập đỉnh mới, người dân xếp hàng bán chốt lời':'giảm, tiệm vàng vắng khách'}. Tiệm vàng mua lại.`,match:a=>a.type==='gold',price:a=>each*a.qty};},
    ()=>{const m=Math.round(rf(.65,1.6)*100)/100;return {stock:m,art:m>=1?'chartup':'chartdown',title:m>=1?`VN-Index tăng mạnh: cổ phiếu ×${trimNum(m,2)}`:`Thị trường giảm sâu: cổ phiếu ×${trimNum(m,2)}`,text:`${m>=1?'Khối ngoại mua ròng, thị trường được nâng hạng.':'Tin đồn siết margin khiến nhà đầu tư bán tháo.'} Giá mọi cổ phiếu bằng ${trimNum(m,2)} lần giá tham chiếu. Ai đang giữ có thể bán (phí 0,15% + thuế 0,1%).`};},
    ()=>{const d=pick([.015,.02,-.01]);return {rate:d,art:'bank',title:d>0?`Lãi suất vay tăng ${pct(d)}/năm`:`Lãi suất vay giảm ${pct(-d)}/năm`,text:`${d>0?'Lạm phát tăng, các ngân hàng điều chỉnh lãi suất thả nổi.':'Ngân hàng Nhà nước hạ lãi suất điều hành để hỗ trợ kinh tế.'} Tiền trả góp tháng của mọi khoản vay bất động sản và doanh nghiệp được tính lại tự động.`};},
    ()=>{const b=wpick(BONDS,BONDS.map(x=>x.w));return {bondDef:b.n,art:'bonddefault',title:`${b.n} chậm trả lãi trái phiếu`,text:`Doanh nghiệp gặp khó khăn dòng tiền, xin gia hạn. Trái chủ ngừng nhận lãi và giá trị gốc chỉ còn 50%.`};},
    ()=>{const m=pick([.5,.7,1.3,1.6,2]);return {btc:m,art:m>=1?'chartup':'chartdown',title:m>=1?`Bitcoin tăng vọt ×${trimNum(m,1)}`:`Bitcoin lao dốc ×${trimNum(m,1)}`,text:m>=1?'Các quỹ lớn đổ tiền vào tiền số. Ai đang giữ Bitcoin có thể bán.':'Một sàn giao dịch lớn phá sản, giá tiền số rơi tự do.',match:a=>a.type==='crypto',price:a=>Math.round(a.qty*btcPrice()*m/1e5)*1e5};},
    ()=>({vacancy:true,art:'vacancy',title:'Khách thuê trả mặt bằng',text:`Khách thuê ${pick(['về quê lập nghiệp','chuyển sang thuê chỗ rẻ hơn','làm ăn thua lỗ'])}. Nếu bạn có bất động sản cho thuê, mất 1 tháng tiền thuê của tài sản lớn nhất trong lúc tìm khách mới.`}),
    ()=>({repair:.01,art:'repair',title:'Sửa chữa lớn',text:'Mùa mưa, trần nhà thấm dột. Nếu bạn có bất động sản cho thuê, trả 1% giá trị tài sản lớn nhất để chống thấm, sơn lại.'}),
  ];
  const w=mode().goodBias?[3,2,1,2,1,1,2,1,1,1,1,1]:[2,1,1,2,1,1,2,2,1,1,1,1];
  return wpick(opts,w)();
}
/* tiêu xài: một số thẻ có lựa chọn */
const DOODADS=[
 {n:'Trám răng sâu',a:2.5,art:'dentist',med:1,s:()=>`Ăn kẹo cả tuần, răng hàm ê buốt. Bác sĩ nha khoa phải trám 2 chiếc.`},
 {n:'Khám sức khỏe tổng quát',a:2,art:'doctor',med:1,s:()=>`Công ty không có gói khám, bạn tự đi bệnh viện tư cho yên tâm.`},
 {n:'Lẩu nướng cuối tuần',a:.8,art:'hotpot',s:()=>`Nhóm bạn đại học hẹn tụ tập, bạn giành trả tiền vì vừa được thưởng.`},
 {n:'Du lịch Đà Lạt 3 ngày',a:6,art:'travel',s:()=>`Đặt homestay view đồi thông, check-in đủ mọi quán cà phê.`},
 {n:'Sửa xe máy',a:1.2,art:'repairbike',s:()=>`Xe chết máy giữa đường ngập, thợ báo phải thay bugi và vệ sinh bình xăng con.`},
 {n:'Quà Tết biếu bố mẹ',a:5,art:'tet',s:()=>`Giỏ quà, lì xì cho bố mẹ hai bên và các cháu.`},
 {n:'Săn sale 11.11',a:3,art:'shopping',s:()=>`Thức đến nửa đêm săn mã giảm giá, mua 7 món mà chưa dùng món nào.`},
 {n:'Tiệc sinh nhật',a:2,art:'party',s:()=>`Tổ chức sinh nhật ở nhà hàng, bánh kem đặt riêng.`},
 {n:'Vé xem concert',a:3,art:'concert',s:()=>`Ca sĩ yêu thích về Việt Nam, vé hạng VIP hết trong 5 phút, phải mua lại giá cao.`},
 {n:'Máy lọc không khí',a:4.5,art:'appliance',s:()=>`Chỉ số bụi mịn vượt ngưỡng, cả nhà ho liên tục.`},
 {n:'Khóa học “làm giàu nhanh”',a:9,art:'scam',s:()=>`Diễn giả hứa "30 ngày có xe sang". Hết khóa học bạn chỉ nhận được một quyển sách.`},
 {n:'Phạt nguội vượt đèn đỏ',a:4,art:'police',s:()=>`Camera ghi hình bạn vượt đèn đỏ lúc vội đi làm. Giấy phạt gửi về nhà.`}];
const DOODAD_LOANS=[{n:'Đổi xe tay ga mới',down:10*TR,bal:60*TR,pay:3*TR,art:'scooter',s:'Showroom tặng mũ bảo hiểm và 1 năm bảo dưỡng.'},{n:'Tủ lạnh trả góp',down:2*TR,bal:12*TR,pay:1.1*TR,art:'fridge',s:'Tủ lạnh cũ kêu to cả đêm, siêu thị điện máy cho trả góp.'}];
/* thẻ lựa chọn: mỗi lựa chọn có chi phí và hệ quả */
function choiceCards(p){const M=mode(),L=[
 {id:'friendwed',art:'wedding',title:'Đám cưới bạn thân',story:`${cap(who())} là bạn thân từ hồi đại học, tổ chức cưới ở trung tâm tiệc cưới lớn.`,opts:[
   {label:'Mừng 2 tr, đi cả nhà',cost:2*TR,net:1,note:'+1 quan hệ: lần tới gặp ô Cơ hội được xem 2 thương vụ'},{label:'Mừng 500k',cost:.5*TR},{label:'Không đi, nhắn tin chúc',cost:0,note:'Tiết kiệm, nhưng bạn bè hơi buồn'}]},
 {id:'lend',art:'opp',title:'Bạn mượn tiền gấp',story:`${cap(who())} cần 20 tr để đóng viện phí cho mẹ, hứa trả trong 1 năm.`,opts:[
   {label:'Cho mượn 20 tr',cost:20*TR,lend:20*TR,net:1,note:'Khả năng cao được trả lại, +1 quan hệ'},{label:'Từ chối khéo',cost:0}]},
 {id:'phone',art:'phone',title:'Điện thoại cũ bị vỡ màn hình',story:'Cửa hàng đang có chương trình trả góp 0% cho mẫu mới nhất.',opts:[
   {label:'Mẫu mới, trả góp 0%',cost:5*TR,liab:{label:'Trả góp điện thoại mới',bal:20*TR,pay:2*TR},note:'+2 tr chi phí/tháng trong 10 tháng'},{label:'Thay màn hình 2 tr',cost:2*TR},{label:'Mua máy cũ 4 tr',cost:4*TR}]},
 {id:'study',art:'scholar',title:'Học chứng chỉ nâng cao',story:'Công ty khuyến khích học thạc sĩ hoặc chứng chỉ quốc tế. Học xong có thể được tăng lương.',opts:[
   {label:`Học thạc sĩ (${fmt(Math.round(p.salary*6/1e6)*1e6)})`,cost:Math.round(p.salary*6/1e6)*1e6,raise:.2,note:'Lương tăng 20% ngay'},{label:'Học khóa online 3 tr',cost:3*TR,raise:.04,note:'Lương tăng 4%'},{label:'Thôi, để sau',cost:0}]},
 {id:'car',art:'scooter',title:'Mua ô tô cho "bằng bạn bằng bè"',story:'Đồng nghiệp ai cũng có xe, sếp hỏi sao bạn vẫn đi xe máy. Showroom cho vay 80%.',opts:[
   {label:'Mua xe 700 tr, vay 80%',cost:140*TR,liab:{label:'Vay mua ô tô',bal:560*TR,pay:11.5*TR},note:'+11,5 tr chi phí/tháng, xe mất giá mỗi năm'},{label:'Vẫn đi xe máy',cost:0,note:'Tiết kiệm được dòng tiền'}]}];
  const tr=tier(p),kidsSchool=p.kidAges.filter(a=>a>=6&&a<18).length;
 if(kidsSchool&&!p.schoolSet)L.push({id:'school',art:'school',title:'Chọn trường cho con',story:`Năm học mới. Cả nhà bàn nên cho ${kidsSchool>1?'các con':'con'} học trường nào.`,opts:[
   {label:'Trường công gần nhà',cost:0,risk:1,school:0,note:'Rẻ, nhưng lớp đông, phải học thêm nhiều (+1 rủi ro)'},{label:'Trường tư',cost:5*TR,school:3*TR*kidsSchool,net:1,note:`+${fmt(3*TR*kidsSchool)}/tháng, +1 quan hệ`},...(tr>=2?[{label:'Trường quốc tế',cost:30*TR,school:15*TR*kidsSchool,net:2,note:`+${fmt(15*TR*kidsSchool)}/tháng, +2 quan hệ với phụ huynh doanh nhân`}]:[])]});
 L.push({id:'travel',art:'travel',title:'Kỳ nghỉ hè của gia đình',story:'Cả nhà muốn đi biển sau một năm làm việc vất vả.',opts:[
   {label:'Đi xe khách, ở nhà nghỉ',cost:3*TR,risk:1,note:'Rẻ, nhưng mệt và dễ ốm (+1 rủi ro)'},{label:'Tour trọn gói 3 sao',cost:12*TR},...(tr>=2?[{label:'Resort 5 sao Phú Quốc',cost:45*TR,net:1,note:'Đắt, nhưng gặp gỡ nhiều người có điều kiện (+1 quan hệ)'}]:[]),{label:'Ở nhà',cost:0}]});
 if(tr>=2&&!p.liabs.some(l=>l.label==='Vay mua ô tô'))L.push({id:'car2',art:'scooter',title:'Gia đình muốn mua ô tô',story:'Đã có chút của ăn của để, vợ/chồng và họ hàng đều giục mua xe cho "đỡ khổ".',opts:[
   {label:'Mua xe 900 tr, vay 70%',cost:270*TR,liab:{label:'Vay mua ô tô',bal:630*TR,pay:13*TR},note:'+13 tr/tháng trả góp, cộng xăng xe, gửi xe'},{label:'Thuê xe khi cần',cost:0,note:'Giữ tiền cho đầu tư'}]});
 if(M.insurance&&!p.hins)L.push({id:'ins',art:'doctor',title:'Tư vấn bảo hiểm sức khỏe',story:'Nhân viên bảo hiểm gọi điện: "Anh chị có biết một lần nằm viện có thể tốn cả trăm triệu?"',opts:[
   {label:`Mua bảo hiểm (${fmt(Math.round(p.salary*.015/1e4)*1e4)}/tháng)`,cost:0,ins:true,note:'Chi trả 80% viện phí khi ốm'},{label:'Không mua',cost:0}]});
 return L;}
const p0=()=>G&&G.players&&curP();
function medicalCard(){return {n:pick(['Nằm viện mổ ruột thừa','Sốt xuất huyết phải nhập viện','Gãy tay khi chơi thể thao']),a:rnd(30,90),art:'doctor',med:1,s:()=>'Bệnh viện yêu cầu tạm ứng viện phí trước khi điều trị.'};}
function marketLife(){}

/* ================= thành tích ================= */
const ACH={
 first:{n:'Tài sản đầu tiên',d:'Mua tài sản tạo thu nhập đầu tiên'},
 landlord:{n:'Chủ nhà',d:'Sở hữu bất động sản cho thuê'},
 boss:{n:'Ông chủ',d:'Sở hữu một doanh nghiệp'},
 emerg:{n:'Quỹ khẩn cấp',d:'Tiền mặt và tiết kiệm đủ 6 tháng chi phí'},
 nodebt:{n:'Không nợ xấu',d:'Không còn vay tiêu dùng, thẻ tín dụng hay trả góp mua sắm'},
 half:{n:'Nửa đường',d:'Thu nhập thụ động đạt 50% chi phí'},
 free:{n:'Tự do tài chính',d:'Thoát vòng chuột'},
 free40:{n:'Tự do trước 40',d:'Thoát vòng chuột trước 40 tuổi'},
 billion:{n:'Tỷ phú',d:'Tài sản ròng từ 1 tỷ'},
 noscam:{n:'Không cắn câu',d:'Từ chối một lời mời lừa đảo'},
 donor:{n:'Nhà hảo tâm',d:'Làm từ thiện 3 lần'},
 dream:{n:'Chạm tới giấc mơ',d:'Chiến thắng ván chơi'},
 fq:{n:'Kế toán giỏi',d:'Ghi sổ đúng hoàn toàn 10 lần'}};
const BADDEBT=['card','phone','laptop','moto','x'];
function checkAch(p){const got=[];const c=calc(p),nw=netWorth(p);
  const want={first:p.assets.some(a=>a.type!=='scam'&&a.type!=='gold'),landlord:p.assets.some(a=>a.type==='re'&&a.kind!=='land'),boss:p.assets.some(a=>a.type==='biz'&&a.kind!=='startup'),
    emerg:!p.ft&&p.cash+p.dep>=c.totalExp*6,nodebt:!p.loan&&!p.liabs.some(l=>BADDEBT.includes(l.key)||String(l.key).startsWith('x')),half:!p.ft&&c.passive>=c.totalExp*.5,free:p.ft,free40:p.ft&&p.freeAge&&p.freeAge<40,billion:nw>=TY,dream:p.won};
  for(const k in want)if(want[k]&&!p.ach[k]){p.ach[k]=G.turn;got.push(k);}
  return got;}
