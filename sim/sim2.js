// Mô phỏng với dòng thời gian mới (mỗi lượt 4 tháng). node sim2.js <N> <easy|hard> [botLvl]
const fs=require('fs');
global.toast=()=>{};global.sfx=()=>{};global.who=()=>'anh Tuấn';global.NAMES=['anh Tuấn'];global.SELLER=['x'];global.assetLabel=a=>a.name||a.type;
global.document={querySelector:()=>null};
let src=fs.readFileSync(__dirname+'/engine2.js','utf8');
eval(src.replace(/^const /gm,'var ').replace(/^let /gm,'var ').replace(/^function (\w+)/gm,'global.$1=function $1'));
const N=+process.argv[2]||200, MODE=process.argv[3]||'hard', LVL=process.argv[4]||'normal';
const roll=n=>{let s=0;for(let i=0;i<n;i++)s+=1+Math.floor(Math.random()*6);return s;};
function sellMaybe(p,a,net,basis){const g=basis>0?(net-basis)/basis:1;if(net>0&&(g>=.3||(assetCF(a)<0&&g>=0))){p.assets.splice(p.assets.indexOf(a),1);p.cash+=net;}}
function buyProp(p,d,x){const a=d.a,R=analyze(a,x);pay(p,R.equity,'');const as={...a,loan:R.loan,pay:R.pmtM,left:R.loan?a.term*12:0,equity:R.equity};if(a.teaser){as.rate=a.teaser.rate;as.teaserLeft=a.teaser.months;}p.assets.push(as);}
function opp(p){const big=tier(p)>=2&&p.cash>400*TR;let d=big?drawBig():drawSmall();if(p.net>0){p.net--;const d2=big?drawBig():drawSmall();if(bestCoc(d2)>bestCoc(d))d=d2;}
  const L=BOT_LVL[p.botLvl];
  if(d.k==='stock'){const S=STOCKS[d.sym],ref=d.ref;p.assets.filter(a=>a.type==='stock'&&a.sym===d.sym).forEach(a=>sellMaybe(p,a,a.shares*d.price*(1-STK_FEE-STK_TAX),a.shares*a.cost));
    const good=S.div/d.price>=.05||d.price<=ref*.8,q=Math.floor(Math.min(p.cash*L.stk,200*TR)/d.price/100)*100;if(good&&q>0&&d.sym!=='DBX'){const tot=q*d.price*(1+STK_FEE);pay(p,tot,'');const h=p.assets.find(a=>a.type==='stock'&&a.sym===d.sym);if(h){h.cost=(h.cost*h.shares+tot)/(h.shares+q);h.shares+=q;}else p.assets.push({type:'stock',sym:d.sym,shares:q,cost:tot/q});}return;}
  if(d.k==='bond'){const u=Math.min(20,Math.floor(p.cash*.25/(10*TR)));if(d.b.risk!=='Cao'&&u>0){pay(p,u*10*TR,'');p.assets.push({type:'bond',issuer:d.b.n,units:u,face:10*TR,coupon:d.b.c,def:false});}return;}
  if(d.k==='sdiv'){p.assets.filter(a=>a.type==='stock'&&a.sym===d.sym).forEach(a=>{const add=Math.floor(a.shares*d.ratio);a.cost=a.cost*a.shares/(a.shares+add);a.shares+=add;});return;}
  if(d.k==='delist'){p.assets=p.assets.filter(a=>!(a.type==='stock'&&a.sym==='DBX'));return;}
  if(d.k==='scam'){if(p.botLvl==='risky'&&Math.random()<.3){const amt=Math.min(50*TR,p.cash);if(amt>0){p.cash-=amt;p.assets.push({type:'scam',name:d.name,amount:amt,promise:d.promise,paid:0,turns:2});}}return;}
  if(d.k==='side'){if(p.sides.length<2&&tier(p)<3)p.sides.push({name:d.name,inc:d.inc});return;}
  if(d.k==='crypto')return;
  if(d.k==='gold')return;if(d.k==='prop'){const x=botPick(p,d);if(x!=null)buyProp(p,d,x);}}
function market(p){const m=drawMarket();
  if(m.rate){p.assets.forEach(a=>{if(a.loan>0&&a.left>0&&!(a.teaserLeft>0)){a.rate=Math.max(.04,a.rate+m.rate);a.pay=pmt(a.loan,a.rate,a.left/12);}});return;}
  if(m.bondDef){p.assets.forEach(a=>{if(a.type==='bond'&&a.issuer===m.bondDef&&!a.def){a.def=true;a.face/=2;}});return;}
  if(m.vacancy||m.repair){const big=p.assets.filter(a=>a.type==='re'&&a.kind!=='land').sort((x,y)=>y.price-x.price)[0];if(big)pay(p,m.vacancy?big.rent:big.price*m.repair,'');return;}
  const match=m.stock?(a=>a.type==='stock'):m.match,priceOf=m.stock?(a=>STOCKS[a.sym].base*m.stock*a.shares):m.price;
  p.assets.filter(match).forEach(a=>{const price=priceOf(a);let net,basis;if(a.type==='re'){net=price-a.loan-price*TAX_SELL_RE;basis=a.equity;}else if(a.type==='biz'){net=price-a.loan;basis=a.equity;}else if(a.type==='stock'){net=price*(1-STK_FEE-STK_TAX);basis=a.shares*a.cost;}else{net=price;basis=a.cost;}sellMaybe(p,a,net,basis);});}
function events(p){while(p.events.length){const e=p.events.shift();
  if(e.k==='marry'){if(p.cash>60*TR||Math.random()<.5){pay(p,60*TR,'');p.spouse=rnd(8,20)*TR;p.living*=1.4;}else p.single=Math.random()<.3;}
  if(e.k==='parents'){p.parentCare=3*TR*p.cpi;}}}
function doodad(p){const M=mode(),r=Math.random();
  if(r<.25){const cs=choiceCards(p),c=pick(cs);let o=c.opts[c.opts.length-1];
    if(c.id==='ins')o=c.opts[0];if(c.id==='school')o=c.opts[0];if(c.id==='travel'||c.id==='car2')o=c.opts[c.opts.length-1];if(c.id==='study'&&p.cash>c.opts[0].cost*2)o=c.opts[0];else if(c.id==='study')o=c.opts[1];if(c.id==='friendwed')o=c.opts[1];if(c.id==='phone')o=c.opts[1];
    pay(p,o.cost,'');if(o.ins)p.hins=true;if(o.raise)p.salary*=1+o.raise;if(o.liab)p.liabs.push({key:'x',...o.liab});if(o.net)p.net++;if(o.risk)p.risk+=o.risk;if(c.id==='school'){p.schoolPrem=o.school||0;p.schoolSet=true;}return;}
  if(M.insurance&&r<Math.min(.45,.32+.03*p.risk)){const m=medicalCard();pay(p,m.a*TR*(1+.15*p.risk)*(p.hins?.2:1),'');p.risk=Math.max(0,p.risk-2);return;}
  if(r<.42){const d=pick(DOODAD_LOANS);pay(p,d.down,'');p.liabs.push({key:'x',label:d.n,bal:d.bal,pay:d.pay});return;}
  if(r<.5&&p.kids){pay(p,1.5*TR*p.kids,'');return;}
  pay(p,pick(DOODADS).a*TR*M.doodadMul,'');}
let p;function playOne(pi){
  G={v:4,btcIdx:1,mode:MODE,scenario:'normal',dreams:DREAMS.slice(0,4),players:[],cur:0,turn:1,log:[],stockIdx:1,rateAdj:0,cyc:{land:'normal',re:'normal',stock:'normal'},month:0};
  p=newPlayer(0,{char:'pig',bot:true,botLvl:LVL,dream:Math.floor(Math.random()*4)},PROFS[pi],'sim','normal');G.players.push(p);G.cur=0;
  const start=p.age;let escape=null,winT=null,escAge=null,winAge=null;
  for(let t=1;t<=150;t++){G.turn=t;const m0=G.month||0;G.month=(t-1)*mpt();if(Math.floor(G.month/12)>Math.floor(m0/12))newYear();
    advanceTurn(p);events(p);if(p.out)break;
    if(p.skip>0){p.skip--;continue;}
    if(!p.ft){botHousekeeping(p);const n=p.charity>0?2:1;if(p.charity>0)p.charity--;const st=roll(n);
      for(let s=0;s<st;s++){p.pos=(p.pos+1)%24;if(BOARD[p.pos]==='midbonus')p.cash+=p.salary*rf(...mode().midBonus);if(BOARD[p.pos]==='tetbonus')p.cash+=p.salary*rf(...mode().tetBonus);}
      const tl=BOARD[p.pos];
      if(tl==='opp')opp(p);else if(tl==='market')market(p);else if(tl==='doodad')doodad(p);
      else if(tl==='charity'){const amt=calc(p).income*.1;if(p.cash>amt*4){pay(p,amt,'');p.charity=3;}}
      else if(tl==='baby'){if(p.kidAges.length<3&&p.age<45){p.kidAges.push(0);p.kids++;}}
      else if(tl==='downsized'){p.skip=mode().downSkip;p.benefitLeft=1;}
      const c=calc(p);if(c.passive>c.totalExp){escape=t;escAge=p.age;p.ft=true;p.ftCF=Math.max(500*TR,Math.round(c.passive*100/(10*TR))*10*TR);p.ftStart=p.ftCF;p.cash+=p.ftCF;p.ftPos=0;}
    }else{p.age+=mpt()/12;const st=roll(p.charity>0?3:2);if(p.charity>0)p.charity--;
      for(let s=0;s<st;s++){p.ftPos=(p.ftPos+1)%FT.length;if(FT[p.ftPos].t==='cf')p.cash+=p.ftCF;}
      const f=FT[p.ftPos];
      if(f.t==='biz'&&p.cash>=f.cost&&!p.ftAssets.some(a=>a.idx===p.ftPos)){p.cash-=f.cost;p.ftCF+=f.cf;p.ftAssets.push({idx:p.ftPos,cf:f.cf});}
      else if(f.t==='dream'&&f.slot===p.dream&&p.cash>=G.dreams[f.slot].c){winT=t;winAge=p.age;break;}
      else if(f.t==='lawsuit'||f.t==='audit')p.cash/=2;else if(f.t==='divorce')p.cash=0;
      if(p.ftCF>=p.ftStart+ftGoal()){winT=t;winAge=p.age;break;}}
  }
  return {escape,winT,escAge,winAge,start};
}
const q=(a,f)=>{a=a.filter(x=>x!=null).sort((x,y)=>x-y);return a.length?Math.round(a[Math.floor(a.length*f)]*10)/10:'-';};
const res={};
PROFS.forEach((pr,pi)=>{const R=[];for(let i=0;i<N;i++)R.push(playOne(pi));
  res[pr.n]={start:pr.age,escT:q(R.map(r=>r.escape),.5),escAge:q(R.map(r=>r.escAge),.5),esc25:q(R.map(r=>r.escAge),.25),esc75:q(R.map(r=>r.escAge),.75),escBy50:Math.round(R.filter(r=>r.escAge!=null&&r.escAge<=50).length/N*100)+'%',escBy60:Math.round(R.filter(r=>r.escAge!=null&&r.escAge<=60).length/N*100)+'%',fail:Math.round(R.filter(r=>r.winT==null).length/N*100)+'%'};});
console.log('MODE',MODE,'BOT',LVL);console.table(res);
