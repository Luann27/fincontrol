import { useState, useMemo, useEffect } from "react";
import { BarChart, Bar, PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

// ─── SUPABASE ─────────────────────────────────────────────────────────────────
const SUPA_URL = "https://eoajfzjugksyvlftccvb.supabase.co";
const SUPA_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVvYWpmemp1Z2tzeXZsZnRjY3ZiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM1OTk1MTYsImV4cCI6MjA4OTE3NTUxNn0.HuV88xk2ZYc48WWw8A7BPpX2vrvSHi6ZHfIng68k89A";
const USER_ID  = "luan";

const req = async (url, opts = {}) => {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 10000);
  try {
    const r = await fetch(url, { ...opts, signal: controller.signal });
    clearTimeout(t);
    return r;
  } catch(e) { clearTimeout(t); throw e; }
};

const db = {
  async get(table, extra = "") {
    try {
      const r = await req(`${SUPA_URL}/rest/v1/${table}?user_id=eq.${USER_ID}${extra}&order=created_at.desc`, {
        headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` }
      });
      return r.ok ? r.json() : [];
    } catch(e) { console.error(`get ${table}:`, e.message); return []; }
  },
  async insert(table, row) {
    try {
      // Limpa campos undefined/null/empty para evitar erros no Supabase
      const clean = Object.fromEntries(
        Object.entries({ ...row, user_id: USER_ID })
          .filter(([,v]) => v !== undefined && v !== null && v !== "")
      );
      const r = await req(`${SUPA_URL}/rest/v1/${table}`, {
        method: "POST",
        headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}`, "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify(clean)
      });
      if (!r.ok) { const e = await r.text(); console.error(`insert ${table}:`, e); return false; }
      return true;
    } catch(e) { console.error(`insert ${table}:`, e.message); return false; }
  },
  async remove(table, id) {
    try {
      const r = await req(`${SUPA_URL}/rest/v1/${table}?id=eq.${id}&user_id=eq.${USER_ID}`, {
        method: "DELETE", headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` }
      });
      return r.ok;
    } catch(e) { console.error(`remove ${table}:`, e.message); return false; }
  },
  async update(table, id, row) {
    try {
      const r = await req(`${SUPA_URL}/rest/v1/${table}?id=eq.${id}&user_id=eq.${USER_ID}`, {
        method: "PATCH",
        headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify(row)
      });
      return r.ok;
    } catch(e) { console.error(`update ${table}:`, e.message); return false; }
  }
};

// ─── THEME ────────────────────────────────────────────────────────────────────
const C = {
  bg: "#07090f", surface: "#0e1118", card: "#13171f", border: "#1c2235",
  accent: "#00d4aa", accentDim: "#00d4aa18", accentGlow: "#00d4aa40",
  blue: "#4d9eff", red: "#ff4d6d", yellow: "#ffd666", purple: "#9b7dff",
  orange: "#ff8c42", text: "#e8ecf4", muted: "#5a6680", subtle: "#1c2235",
};
const PALETTE = [C.accent, C.blue, C.yellow, C.purple, C.red, C.orange, "#66ffcc", "#ff99cc", "#aaddff", "#ffaacc"];

const DEFAULT_CATS = {
  rec: [
    { id:"r1", nome:"Salário",       subs:["CLT","PJ"] },
    { id:"r2", nome:"Freelance",     subs:["Design","Dev","Consultoria"] },
    { id:"r3", nome:"Dividendos",    subs:["Ações","FIIs","Exterior"] },
    { id:"r4", nome:"Outros Ganhos", subs:["Vendas","Reembolso","Presente"] },
  ],
  desp: [
    { id:"d1", nome:"Moradia",       subs:["Aluguel","Condomínio","IPTU","Luz","Água","Internet"] },
    { id:"d2", nome:"Alimentação",   subs:["Supermercado","Restaurante","Delivery","Padaria"] },
    { id:"d3", nome:"Transporte",    subs:["Combustível","Uber","Ônibus","IPVA","Seguro Auto"] },
    { id:"d4", nome:"Lazer",         subs:["Cinema","Viagem","Jogos","Academia","Esporte"] },
    { id:"d5", nome:"Saúde",         subs:["Consulta","Remédio","Plano de Saúde","Dentista"] },
    { id:"d6", nome:"Assinaturas",   subs:["Streaming","Software","Clube","Revista"] },
    { id:"d7", nome:"Educação",      subs:["Curso","Livro","Faculdade","Idioma"] },
    { id:"d8", nome:"Investimentos", subs:["Ações","FIIs","Renda Fixa","Cripto"] },
    { id:"d9", nome:"Outros",        subs:[] },
  ],
};

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const fmt      = v => new Intl.NumberFormat("pt-BR", { style:"currency", currency:"BRL" }).format(Number(v)||0);
const fmtPct   = v => `${Number(v)>0?"+":""}${Number(v).toFixed(2)}%`;
const uid      = () => Math.random().toString(36).slice(2,10);
const hoje     = () => new Date().toISOString().slice(0,10);
const mesAtual = () => { const d=new Date(); return `${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear()}`; };
// Parse seguro de data sem fuso horário (evita bug dia 1° virar mês anterior)
const parseData = (s) => { if(!s) return new Date(); const [y,m,d]=s.split("-").map(Number); return new Date(y,m-1,d); };
const getMesAno = (s) => { const d=parseData(s); return {m:d.getMonth()+1, a:d.getFullYear()}; };

function useIsDesktop() {
  const [ok, setOk] = useState(window.innerWidth >= 768);
  useEffect(() => { const fn=()=>setOk(window.innerWidth>=768); window.addEventListener("resize",fn); return ()=>window.removeEventListener("resize",fn); },[]);
  return ok;
}

// ─── BASE UI ──────────────────────────────────────────────────────────────────
const Card   = ({children,style={}}) => <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:16,...style}}>{children}</div>;
const Badge  = ({children,color=C.accent}) => <span style={{background:color+"22",color,border:`1px solid ${color}44`,borderRadius:6,padding:"2px 8px",fontSize:11,fontWeight:700}}>{children}</span>;
const Btn    = ({children,onClick,color=C.accent,outline=false,small=false,full=false,danger=false,style={}}) => (
  <button onClick={onClick} style={{padding:small?"7px 14px":"9px 18px",borderRadius:9,border:outline?`1px solid ${danger?C.red:color}`:"none",background:danger?C.red+"22":outline?"transparent":color,color:danger?C.red:outline?color:C.bg,fontWeight:700,fontSize:small?12:13,cursor:"pointer",width:full?"100%":"auto",fontFamily:"inherit",...style}}>{children}</button>
);
const InputField = ({label,value,onChange,type="text",placeholder="",options=null}) => (
  <div style={{display:"flex",flexDirection:"column",gap:5}}>
    {label && <label style={{color:C.muted,fontSize:11,fontWeight:700,letterSpacing:1,textTransform:"uppercase"}}>{label}</label>}
    {options
      ? <select value={value} onChange={e=>onChange(e.target.value)} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:9,padding:"10px 12px",color:value?C.text:C.muted,fontSize:13,outline:"none",fontFamily:"inherit",WebkitAppearance:"none"}}>
          <option value="">Selecionar...</option>
          {options.map((o,i)=><option key={i} value={typeof o==="string"?o:o.value}>{typeof o==="string"?o:o.label}</option>)}
        </select>
      : <input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:9,padding:"10px 12px",color:C.text,fontSize:13,outline:"none",fontFamily:"inherit",width:"100%"}} />
    }
  </div>
);
const Modal  = ({title,onClose,children}) => (
  <div onClick={e=>e.target===e.currentTarget&&onClose()} style={{position:"fixed",inset:0,background:"#000b",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:20}}>
    <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:18,width:"100%",maxWidth:520,maxHeight:"90vh",overflow:"auto",padding:24}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
        <h3 style={{margin:0,color:C.text,fontWeight:800,fontSize:16}}>{title}</h3>
        <button onClick={onClose} style={{background:C.subtle,border:"none",color:C.muted,borderRadius:8,width:30,height:30,cursor:"pointer",fontSize:18,lineHeight:1}}>×</button>
      </div>
      {children}
    </div>
  </div>
);
const Empty   = ({icon,msg,sub}) => (
  <div style={{display:"flex",flexDirection:"column",alignItems:"center",padding:"36px 20px",gap:8}}>
    <div style={{fontSize:36,opacity:0.25}}>{icon}</div>
    <div style={{color:C.muted,fontWeight:700,fontSize:14}}>{msg}</div>
    {sub&&<div style={{color:C.muted,fontSize:12,opacity:0.6,textAlign:"center"}}>{sub}</div>}
  </div>
);
const Spinner = () => <div style={{display:"flex",justifyContent:"center",padding:40}}><div style={{width:28,height:28,border:`3px solid ${C.border}`,borderTopColor:C.accent,borderRadius:"50%",animation:"spin 0.8s linear infinite"}} /></div>;
const MiniTooltip = ({active,payload,label}) => {
  if (!active||!payload?.length) return null;
  return <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:"8px 14px",fontSize:12}}><div style={{color:C.muted,marginBottom:4}}>{label}</div>{payload.map((p,i)=><div key={i} style={{color:p.color||C.text,fontWeight:700}}>{fmt(p.value)}</div>)}</div>;
};
const StatCard = ({label,value,color=C.text,sub}) => (
  <Card>
    <div style={{color:C.muted,fontSize:10,letterSpacing:1,textTransform:"uppercase"}}>{label}</div>
    <div style={{color,fontSize:20,fontWeight:900,fontFamily:"'DM Mono',monospace",marginTop:4}}>{value}</div>
    {sub&&<div style={{color:C.muted,fontSize:11,marginTop:2}}>{sub}</div>}
  </Card>
);
const SectionTitle = ({children}) => <div style={{color:C.muted,fontSize:10,fontWeight:700,letterSpacing:2,textTransform:"uppercase",padding:"4px 0 8px"}}>{children}</div>;

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
function Dashboard({ transacoes, contas, ativos, setTransacoes, setContas, loading }) {
  const now  = new Date();
  const [mesSel, setMesSel] = useState(now.getMonth()+1);
  const [anoSel, setAnoSel] = useState(now.getFullYear());
  const [saving, setSaving] = useState(false);

  const mesN = mesSel, anoN = anoSel;
  const mesNome = new Date(anoSel, mesSel-1, 1).toLocaleString("pt-BR",{month:"long",year:"numeric"});

  const navMes = (dir) => {
    setMesSel(p => {
      let m = p + dir, a = anoSel;
      if (m > 12) { m = 1; setAnoSel(a+1); }
      else if (m < 1) { m = 12; setAnoSel(a-1); }
      return m;
    });
  };

  const doMes   = transacoes.filter(t=>{ const {m,a}=getMesAno(t.data); return m===mesN&&a===anoN; });
  const recMes  = doMes.filter(t=>t.tipo==="rec" &&t.cat!=="Transferência").reduce((s,t)=>s+Number(t.valor),0);
  const despMes = doMes.filter(t=>t.tipo==="desp"&&t.cat!=="Transferência").reduce((s,t)=>s+Number(t.valor),0);
  const resultado = recMes - despMes;

  // Saldo real = saldo inicial + todos os lançamentos
  const totalRecAll  = transacoes.filter(t=>t.tipo==="rec" &&t.cat!=="Transferência").reduce((s,t)=>s+Number(t.valor),0);
  const totalDespAll = transacoes.filter(t=>t.tipo==="desp"&&t.cat!=="Transferência").reduce((s,t)=>s+Number(t.valor),0);
  const saldoBase    = contas.reduce((s,c)=>s+Number(c.saldo),0);
  const saldoContas  = saldoBase + totalRecAll - totalDespAll;
  const valorAtivos  = ativos.reduce((s,a)=>s+Number(a.atual||a.pmedio)*Number(a.qtd),0);
  const total        = saldoContas + valorAtivos;


  const byMonth = useMemo(()=>{
    const meses={};
    transacoes.forEach(t=>{
      const {m,a}=getMesAno(t.data);
      const key=`${String(a)}-${String(m).padStart(2,"0")}`;
      if(!meses[key])meses[key]={rec:0,desp:0};
      if(t.tipo==="rec"&&t.cat!=="Transferência")meses[key].rec+=Number(t.valor);
      if(t.tipo==="desp"&&t.cat!=="Transferência")meses[key].desp+=Number(t.valor);
    });
    return Object.entries(meses).sort().slice(-6).map(([key,v])=>({
      mes:`${key.slice(5)}/${key.slice(2,4)}`,...v
    }));
  },[transacoes]);

  const gastosCat = useMemo(()=>{
    const map={};
    doMes.filter(t=>t.tipo==="desp"&&t.cat!=="Transferência").forEach(t=>{map[t.cat||"Outros"]=(map[t.cat||"Outros"]||0)+Number(t.valor);});
    return Object.entries(map).map(([nome,valor],i)=>({nome,valor,cor:PALETTE[i%PALETTE.length]})).sort((a,b)=>b.valor-a.valor).slice(0,7);
  },[doMes]);

  const recCat = useMemo(()=>{
    const map={};
    doMes.filter(t=>t.tipo==="rec"&&t.cat!=="Transferência").forEach(t=>{map[t.cat||"Outros"]=(map[t.cat||"Outros"]||0)+Number(t.valor);});
    return Object.entries(map).map(([nome,valor],i)=>({nome,valor,cor:PALETTE[i%PALETTE.length]})).sort((a,b)=>b.valor-a.valor).slice(0,7);
  },[doMes]);

  const ultimas  = [...transacoes].filter(t=>t.cat!=="Transferência").sort((a,b)=>parseData(b.data)-parseData(a.data)).slice(0,6);
  const proximas = transacoes.filter(t=>t.tipo==="desp"&&t.status==="pendente").sort((a,b)=>parseData(a.data)-parseData(b.data)).slice(0,4);



  if (loading) return <Spinner />;

  const contasBancarias = contas;

  return (
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      {/* Hero */}
      <Card style={{background:"linear-gradient(135deg, #0c1e18, #0a1428)",borderColor:C.accentGlow}}>
        <div style={{color:C.muted,fontSize:10,letterSpacing:2,textTransform:"uppercase"}}>Patrimônio Total</div>
        <div style={{color:C.accent,fontSize:36,fontWeight:900,fontFamily:"'DM Mono',monospace",margin:"6px 0 12px"}}>{fmt(total)}</div>
        <div style={{display:"flex",gap:24,flexWrap:"wrap"}}>
          <div><div style={{color:C.muted,fontSize:9}}>EM CONTAS</div><div style={{color:C.blue,fontWeight:700}}>{fmt(saldoContas)}</div></div>
          <div><div style={{color:C.muted,fontSize:9}}>INVESTIDO</div><div style={{color:C.purple,fontWeight:700}}>{fmt(valorAtivos)}</div></div>
        </div>
      </Card>

      {/* Seletor de mês */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:C.surface,borderRadius:12,padding:"10px 16px"}}>
        <button onClick={()=>navMes(-1)} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:8,width:32,height:32,cursor:"pointer",color:C.text,fontSize:18,display:"flex",alignItems:"center",justifyContent:"center"}}>‹</button>
        <div style={{textAlign:"center"}}>
          <div style={{color:C.text,fontWeight:700,fontSize:14,textTransform:"capitalize"}}>{mesNome}</div>
          <div style={{color:C.muted,fontSize:11}}>{mesSel===now.getMonth()+1&&anoSel===now.getFullYear()?"Mês atual":"Histórico"}</div>
        </div>
        <button onClick={()=>navMes(+1)} disabled={mesSel===now.getMonth()+1&&anoSel===now.getFullYear()} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:8,width:32,height:32,cursor:"pointer",color:mesSel===now.getMonth()+1&&anoSel===now.getFullYear()?C.muted:C.text,fontSize:18,display:"flex",alignItems:"center",justifyContent:"center"}}>›</button>
      </div>

      {/* Stats do mês */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:12}}>
        <StatCard label="Receitas"  value={fmt(recMes)}   color={C.accent} sub="mês atual" />
        <StatCard label="Despesas"  value={fmt(despMes)}  color={C.red}    sub="mês atual" />
        <StatCard label="Resultado" value={fmt(resultado)} color={resultado>=0?C.accent:C.red} sub="saldo do mês" />

      </div>

      {/* Gráfico histórico */}
      {byMonth.length>=2&&(
        <Card>
          <div style={{color:C.text,fontWeight:700,marginBottom:14,fontSize:14}}>Histórico — Receitas vs Despesas</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={byMonth}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
              <XAxis dataKey="mes" tick={{fill:C.muted,fontSize:10}} axisLine={false} tickLine={false} />
              <YAxis tick={{fill:C.muted,fontSize:9}} axisLine={false} tickLine={false} tickFormatter={v=>`${(v/1000).toFixed(0)}k`} />
              <Tooltip content={<MiniTooltip />} />
              <Bar dataKey="rec"  fill={C.accent} radius={[4,4,0,0]} name="Receitas" />
              <Bar dataKey="desp" fill={C.red}    radius={[4,4,0,0]} name="Despesas" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Gráficos de categoria */}
      <div className="grid-2col" style={{display:"grid",gap:16}}>
        {gastosCat.length>0&&(
          <Card>
            <div style={{color:C.text,fontWeight:700,marginBottom:12,fontSize:14}}>📤 Despesas por Categoria</div>
            <ResponsiveContainer width="100%" height={120}>
              <PieChart><Pie data={gastosCat} dataKey="valor" cx="50%" cy="50%" innerRadius={28} outerRadius={52}>{gastosCat.map((c,i)=><Cell key={i} fill={c.cor}/>)}</Pie><Tooltip formatter={v=>fmt(v)} contentStyle={{background:C.card,border:`1px solid ${C.border}`,fontSize:11}}/></PieChart>
            </ResponsiveContainer>
            <div style={{display:"flex",flexDirection:"column",gap:5,marginTop:8}}>
              {gastosCat.slice(0,5).map((c,i)=>(
                <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div style={{display:"flex",alignItems:"center",gap:6}}><div style={{width:7,height:7,borderRadius:"50%",background:c.cor,flexShrink:0}}/><span style={{color:C.muted,fontSize:11}}>{c.nome}</span></div>
                  <span style={{color:C.text,fontSize:11,fontWeight:700}}>{fmt(c.valor)}</span>
                </div>
              ))}
            </div>
          </Card>
        )}
        {recCat.length>0&&(
          <Card>
            <div style={{color:C.text,fontWeight:700,marginBottom:12,fontSize:14}}>📥 Receitas por Categoria</div>
            <ResponsiveContainer width="100%" height={120}>
              <PieChart><Pie data={recCat} dataKey="valor" cx="50%" cy="50%" innerRadius={28} outerRadius={52}>{recCat.map((c,i)=><Cell key={i} fill={c.cor}/>)}</Pie><Tooltip formatter={v=>fmt(v)} contentStyle={{background:C.card,border:`1px solid ${C.border}`,fontSize:11}}/></PieChart>
            </ResponsiveContainer>
            <div style={{display:"flex",flexDirection:"column",gap:5,marginTop:8}}>
              {recCat.slice(0,5).map((c,i)=>(
                <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div style={{display:"flex",alignItems:"center",gap:6}}><div style={{width:7,height:7,borderRadius:"50%",background:c.cor,flexShrink:0}}/><span style={{color:C.muted,fontSize:11}}>{c.nome}</span></div>
                  <span style={{color:C.text,fontSize:11,fontWeight:700}}>{fmt(c.valor)}</span>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>

      {/* Contas bancárias */}
      {contasBancarias.length>0&&(
        <Card>
          <div style={{color:C.text,fontWeight:700,marginBottom:12,fontSize:14}}>Saldo nas Contas</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))",gap:10}}>
            {contasBancarias.map(c=>{
              const rec  = transacoes.filter(t=>t.tipo==="rec" &&t.conta===c.nome).reduce((s,t)=>s+Number(t.valor),0);
              const desp = transacoes.filter(t=>t.tipo==="desp"&&t.conta===c.nome).reduce((s,t)=>s+Number(t.valor),0);
              const saldoReal = Number(c.saldo) + rec - desp;
              return (
                <div key={c.id} style={{background:C.surface,borderRadius:10,padding:"12px 14px",border:`1px solid ${(c.cor||C.accent)}33`}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                    <span style={{fontSize:18}}>{c.icon}</span>
                    <span style={{color:C.muted,fontSize:12}}>{c.nome}</span>
                  </div>
                  <div style={{color:c.cor||C.accent,fontWeight:900,fontFamily:"'DM Mono',monospace",fontSize:16}}>{fmt(saldoReal)}</div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Últimas e próximas */}
      <div className="grid-2col" style={{display:"grid",gap:16}}>
        <Card>
          <div style={{color:C.text,fontWeight:700,marginBottom:12,fontSize:14}}>Últimas Transações</div>
          {ultimas.length===0?<Empty icon="📋" msg="Nenhuma transação" sub="Adicione em Transações"/>:
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {ultimas.map(t=>(
                <div key={t.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 12px",background:C.surface,borderRadius:10}}>
                  <div><div style={{color:C.text,fontSize:13,fontWeight:600}}>{t.descricao}</div><div style={{color:C.muted,fontSize:10}}>{t.cat}{t.subcat?` › ${t.subcat}`:""} · {t.data}</div></div>
                  <span style={{color:t.tipo==="rec"?C.accent:C.red,fontWeight:800,fontFamily:"'DM Mono',monospace",fontSize:13}}>{t.tipo==="rec"?"+":"−"}{fmt(t.valor)}</span>
                </div>
              ))}
            </div>
          }
        </Card>
        <Card>
          <div style={{color:C.text,fontWeight:700,marginBottom:12,fontSize:14}}>Próximas Contas</div>
          {proximas.length===0?<Empty icon="📋" msg="Sem pendências" sub="Lançamentos com status 'pendente' aparecem aqui"/>:
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {proximas.map(t=>(
                <div key={t.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 12px",background:C.surface,borderRadius:10}}>
                  <div><div style={{color:C.text,fontSize:13,fontWeight:600}}>{t.descricao}</div><div style={{color:C.muted,fontSize:10}}>Vence {t.data}</div></div>
                  <div style={{display:"flex",gap:6,alignItems:"center"}}><span style={{color:C.red,fontWeight:700,fontFamily:"'DM Mono',monospace",fontSize:13}}>{fmt(t.valor)}</span><Badge color={C.yellow}>pendente</Badge></div>
                </div>
              ))}
            </div>
          }
        </Card>
      </div>


    </div>
  );
}

// ─── TRANSAÇÕES ───────────────────────────────────────────────────────────────
function Transacoes({ transacoes, setTransacoes, contas, cats, loading }) {
  const [tab, setTab]           = useState("lancamentos");
  const [modal, setModal]       = useState(false);  // false | "novo" | objeto (editar)
  const [saving, setSaving]     = useState(false);
  const [filtro, setFiltro]     = useState("todos");

  const formVazio = { tipo:"desp", descricao:"", valor:"", data:hoje(), cat:"", subcat:"", conta:"", contaDestino:"", status:"pago", recorrencia:"nenhuma" };
  const [form, setForm] = useState(formVazio);
  const f  = k => v => setForm(p=>({...p,[k]:v}));

  const contaOpts       = contas.map(c=>c.nome);
  const catOpts         = cats[form.tipo==="rec"?"rec":"desp"].map(c=>c.nome);
  const catAtual        = cats[form.tipo==="rec"?"rec":"desp"].find(c=>c.nome===form.cat);
  const subsDisponiveis = catAtual?.subs||[];

  const modoEditar = modal && typeof modal === "object";

  const abrirEditar = (t) => {
    setForm({
      tipo: t.tipo, descricao: t.descricao||"", valor: String(t.valor),
      data: t.data, cat: t.cat||"", subcat: t.subcat||"",
      conta: t.conta||"", contaDestino: t.contaDestino||"",
      status: t.status||"pago", recorrencia: t.recorrencia||"nenhuma"
    });
    setModal(t);
  };

  const salvar = async () => {
    if (!form.valor||!form.data) return;
    if (form.tipo==="transf" && (!form.conta||!form.contaDestino)) return;
    if (form.tipo!=="transf" && !form.descricao) return;
    setSaving(true);

    if (modoEditar) {
      // EDITAR lançamento existente
      const atualizado = {...modal, ...form, valor:Number(form.valor)};
      // Se era transf, atualizar os dois lançamentos vinculados (pelo group_id)
      if (atualizado.cat==="Transferência" && atualizado.group_id) {
        const pares = transacoes.filter(t=>t.group_id===atualizado.group_id);
        for (const par of pares) {
          const upd = par.tipo==="desp"
            ? {...par, descricao:atualizado.descricao, valor:Number(form.valor), data:form.data, conta:form.conta}
            : {...par, descricao:atualizado.descricao, valor:Number(form.valor), data:form.data, conta:form.contaDestino};
          await db.update("transacoes", par.id, {descricao:upd.descricao,valor:upd.valor,data:upd.data,conta:upd.conta});
          setTransacoes(p=>p.map(t=>t.id===par.id?upd:t));
        }
      } else {
        await db.update("transacoes", atualizado.id, {
          tipo:atualizado.tipo, descricao:atualizado.descricao, valor:atualizado.valor,
          data:atualizado.data, cat:atualizado.cat, subcat:atualizado.subcat,
          conta:atualizado.conta, status:atualizado.status, recorrencia:atualizado.recorrencia
        });
        setTransacoes(p=>p.map(t=>t.id===atualizado.id?atualizado:t));
      }
    } else {
      // NOVO lançamento
      if (form.tipo==="transf") {
        const group_id = uid();
        const desc = form.descricao||`Transferência ${form.conta} → ${form.contaDestino}`;
        const saida   = {id:uid(),group_id,tipo:"desp",descricao:desc,valor:Number(form.valor),data:form.data,cat:"Transferência",subcat:"",conta:form.conta,status:"pago",recorrencia:"nenhuma"};
        const entrada = {id:uid(),group_id,tipo:"rec", descricao:desc,valor:Number(form.valor),data:form.data,cat:"Transferência",subcat:"",conta:form.contaDestino,status:"pago",recorrencia:"nenhuma"};
        setTransacoes(p=>[entrada,saida,...p]);
        await db.insert("transacoes", saida);
        await db.insert("transacoes", entrada);
      } else {
        const nova = {...form, id:uid(), valor:Number(form.valor)};
        setTransacoes(p=>[nova,...p]);
        await db.insert("transacoes", nova);
      }
    }

    setModal(false);
    setForm(formVazio);
    setSaving(false);
  };



  const excluir = async (t) => {
    // Se for transferência, excluir o par
    if (t.cat==="Transferência" && t.group_id) {
      const pares = transacoes.filter(x=>x.group_id===t.group_id);
      for (const par of pares) { await db.remove("transacoes",par.id); }
      setTransacoes(p=>p.filter(x=>x.group_id!==t.group_id));
    } else {
      await db.remove("transacoes",t.id);
      setTransacoes(p=>p.filter(x=>x.id!==t.id));
    }
  };

  // Separar lançamentos: financeiros vs transferências
  const lancFinanceiros = transacoes.filter(t=>t.cat!=="Transferência");
  const transferencias  = transacoes.filter(t=>t.cat==="Transferência"&&t.tipo==="desp"); // só 1 lado por transferência

  const listaFin = [...(
    filtro==="todos" ? lancFinanceiros :
    filtro==="rec"   ? lancFinanceiros.filter(t=>t.tipo==="rec") :
                       lancFinanceiros.filter(t=>t.tipo==="desp")
  )].sort((a,b)=>parseData(b.data)-parseData(a.data));

  if (loading) return <Spinner />;

  const CONTA_COR = {};
  contas.forEach((c,i)=>{ CONTA_COR[c.nome]=PALETTE[i%PALETTE.length]; });

  return (
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      {/* Tabs */}
      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        <div style={{display:"flex",gap:4}}>
          {[["lancamentos","💰 Lançamentos"],["transf","🔄 Transferências"]].map(([id,label])=>(
            <button key={id} onClick={()=>setTab(id)} style={{flex:1,padding:"9px 6px",borderRadius:9,border:"none",cursor:"pointer",fontSize:11,fontWeight:700,background:tab===id?C.card:C.surface,color:tab===id?C.text:C.muted,fontFamily:"inherit",boxShadow:tab===id?`0 0 0 1px ${C.border}`:"none"}}>{label}</button>
          ))}
        </div>
        {tab==="lancamentos"&&(
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            {[["todos","Todos"],["rec","📥 Receitas"],["desp","📤 Despesas"]].map(([v,l])=>(
              <button key={v} onClick={()=>setFiltro(v)} style={{padding:"6px 12px",borderRadius:8,border:"none",cursor:"pointer",fontSize:11,fontWeight:700,background:filtro===v?C.accent:C.surface,color:filtro===v?C.bg:C.muted,fontFamily:"inherit"}}>{l}</button>
            ))}
            <Btn onClick={()=>{setForm(formVazio);setModal("novo");}} small style={{marginLeft:"auto"}}>+ Novo</Btn>
          </div>
        )}
        {tab==="transf"&&(
          <div style={{display:"flex",justifyContent:"flex-end"}}>
            <Btn onClick={()=>{setForm({...formVazio,tipo:"transf"});setModal("novo");}} small color={C.blue}>+ Transferência</Btn>
          </div>
        )}

      </div>

      {tab==="lancamentos"&&(
        listaFin.length===0
          ?<Card><Empty icon="💰" msg="Nenhum lançamento" sub="Toque em '+ Novo' para adicionar"/></Card>
          :<div style={{display:"flex",flexDirection:"column",gap:8}}>
            {listaFin.map(t=>{
              const contaCor = CONTA_COR[t.conta]||C.muted;
              return (
                <Card key={t.id} style={{padding:"0",overflow:"hidden",borderLeft:`3px solid ${t.tipo==="rec"?C.accent:C.red}`}}>
                  <div style={{display:"flex",alignItems:"stretch"}}>
                    {/* Ícone tipo */}
                    <div style={{width:40,display:"flex",alignItems:"center",justifyContent:"center",background:t.tipo==="rec"?C.accent+"18":C.red+"18",flexShrink:0,fontSize:16}}>
                      {t.tipo==="rec"?"📥":"📤"}
                    </div>
                    {/* Conteúdo */}
                    <div style={{flex:1,padding:"11px 12px",minWidth:0}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8}}>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{color:C.text,fontSize:13,fontWeight:600,marginBottom:4,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.descricao}</div>
                          <div style={{display:"flex",gap:5,flexWrap:"wrap",alignItems:"center"}}>
                            {/* Conta destacada */}
                            {t.conta&&(
                              <span style={{background:contaCor+"22",color:contaCor,border:`1px solid ${contaCor}44`,borderRadius:6,padding:"2px 8px",fontSize:11,fontWeight:700}}>{t.conta}</span>
                            )}
                            {t.cat&&<Badge color={t.tipo==="rec"?C.accent+"99":C.blue+"99"}>{t.cat}</Badge>}
                            {t.subcat&&<Badge color={C.purple+"99"}>{t.subcat}</Badge>}
                            <Badge color={t.status==="pago"?C.accent+"88":C.yellow+"88"}>{t.status}</Badge>
                            <span style={{color:C.muted,fontSize:10}}>{t.data}</span>
                          </div>
                        </div>
                        {/* Valor e ações */}
                        <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:6,flexShrink:0}}>
                          <span style={{color:t.tipo==="rec"?C.accent:C.red,fontWeight:900,fontFamily:"'DM Mono',monospace",fontSize:15}}>{t.tipo==="rec"?"+":"−"}{fmt(t.valor)}</span>
                          <div style={{display:"flex",gap:4}}>
                            <button onClick={()=>abrirEditar(t)} style={{background:C.accentDim,border:`1px solid ${C.accentGlow}`,borderRadius:6,padding:"3px 8px",cursor:"pointer",color:C.accent,fontSize:11,fontWeight:700}}>✏️</button>
                            <button onClick={()=>excluir(t)} style={{background:C.red+"18",border:`1px solid ${C.red}33`,borderRadius:6,padding:"3px 8px",cursor:"pointer",color:C.red,fontSize:11,fontWeight:700}}>🗑</button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
      )}

      {tab==="transf"&&(
        transferencias.length===0
          ?<Card><Empty icon="🔄" msg="Nenhuma transferência" sub="Transferências entre contas não afetam receitas nem despesas"/></Card>
          :<div style={{display:"flex",flexDirection:"column",gap:8}}>
            {transferencias.sort((a,b)=>parseData(b.data)-parseData(a.data)).map(t=>{
              const entrada = transacoes.find(x=>x.group_id===t.group_id&&x.tipo==="rec");
              return (
                <Card key={t.id} style={{padding:"0",overflow:"hidden",borderLeft:`3px solid ${C.blue}`}}>
                  <div style={{display:"flex",alignItems:"stretch"}}>
                    <div style={{width:40,display:"flex",alignItems:"center",justifyContent:"center",background:C.blue+"18",flexShrink:0,fontSize:16}}>🔄</div>
                    <div style={{flex:1,padding:"11px 12px"}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8}}>
                        <div>
                          <div style={{color:C.text,fontSize:13,fontWeight:600,marginBottom:5}}>{t.descricao}</div>
                          <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                            <div style={{display:"flex",alignItems:"center",gap:6}}>
                              <span style={{background:CONTA_COR[t.conta]+"22",color:CONTA_COR[t.conta]||C.muted,border:`1px solid ${CONTA_COR[t.conta]||C.muted}44`,borderRadius:6,padding:"2px 8px",fontSize:11,fontWeight:700}}>{t.conta||"—"}</span>
                              <span style={{color:C.blue,fontSize:14}}>→</span>
                              <span style={{background:(CONTA_COR[entrada?.conta]||C.accent)+"22",color:CONTA_COR[entrada?.conta]||C.accent,border:`1px solid ${CONTA_COR[entrada?.conta]||C.accent}44`,borderRadius:6,padding:"2px 8px",fontSize:11,fontWeight:700}}>{entrada?.conta||"—"}</span>
                            </div>
                            <span style={{color:C.muted,fontSize:10}}>{t.data}</span>
                          </div>
                        </div>
                        <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:6,flexShrink:0}}>
                          <span style={{color:C.blue,fontWeight:900,fontFamily:"'DM Mono',monospace",fontSize:15}}>{fmt(t.valor)}</span>
                          <button onClick={()=>excluir(t)} style={{background:C.red+"18",border:`1px solid ${C.red}33`,borderRadius:6,padding:"3px 8px",cursor:"pointer",color:C.red,fontSize:11,fontWeight:700}}>🗑</button>
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
      )}

    </div>
  );
}

// ─── PATRIMÔNIO ───────────────────────────────────────────────────────────────
function Patrimonio({ transacoes, contas, ativos, loading }) {
  const totalRec  = transacoes.filter(t=>t.tipo==="rec" &&t.cat!=="Transferência").reduce((s,t)=>s+Number(t.valor),0);
  const totalDesp = transacoes.filter(t=>t.tipo==="desp"&&t.cat!=="Transferência").reduce((s,t)=>s+Number(t.valor),0);
  const saldoBase = contas.reduce((s,c)=>s+Number(c.saldo),0);
  const saldoContas = saldoBase + totalRec - totalDesp;
  const valorAtivos = ativos.reduce((s,a)=>s+Number(a.atual||a.pmedio)*Number(a.qtd),0);
  const total = saldoContas + valorAtivos;

  const evolucao = useMemo(()=>{
    const map={};
    transacoes.forEach(t=>{
      const {m,a}=getMesAno(t.data);
      const key=`${a}-${String(m).padStart(2,"0")}`;
      if(!map[key])map[key]={rec:0,desp:0};
      if(t.tipo==="rec"&&t.cat!=="Transferência")map[key].rec+=Number(t.valor);
      if(t.tipo==="desp"&&t.cat!=="Transferência")map[key].desp+=Number(t.valor);
    });
    let acc=0;
    return Object.entries(map).sort().map(([k,v])=>{ acc+=v.rec-v.desp; return {mes:k.slice(5)+"/"+k.slice(2,4),resultado:v.rec-v.desp,acumulado:acc}; });
  },[transacoes]);

  const distribuicao = [
    {nome:"Contas",valor:saldoContas,cor:C.blue},
    {nome:"Investimentos",valor:valorAtivos,cor:C.purple},
  ].filter(d=>d.valor>0);

  if (loading) return <Spinner />;

  return (
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      <Card style={{background:"linear-gradient(135deg, #0c1e18, #0a1428)",borderColor:C.accentGlow}}>
        <div style={{color:C.muted,fontSize:10,letterSpacing:2,textTransform:"uppercase"}}>Patrimônio Total</div>
        <div style={{color:C.accent,fontSize:36,fontWeight:900,fontFamily:"'DM Mono',monospace",margin:"6px 0 14px"}}>{fmt(total)}</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:16}}>
          <div><div style={{color:C.muted,fontSize:9}}>CONTAS BANCÁRIAS</div><div style={{color:C.blue,fontWeight:700,fontSize:15}}>{fmt(saldoContas)}</div></div>
          <div><div style={{color:C.muted,fontSize:9}}>INVESTIMENTOS</div><div style={{color:C.purple,fontWeight:700,fontSize:15}}>{fmt(valorAtivos)}</div></div>
        </div>
      </Card>

      <div className="grid-2col" style={{display:"grid",gap:16}}>
        {evolucao.length>=2
          ?<Card>
            <div style={{color:C.text,fontWeight:700,marginBottom:14,fontSize:14}}>Evolução do Resultado Acumulado</div>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={evolucao}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.border}/>
                <XAxis dataKey="mes" tick={{fill:C.muted,fontSize:10}} axisLine={false} tickLine={false}/>
                <YAxis tick={{fill:C.muted,fontSize:9}} axisLine={false} tickLine={false} tickFormatter={v=>`${(v/1000).toFixed(0)}k`}/>
                <Tooltip content={<MiniTooltip/>}/>
                <Line type="monotone" dataKey="acumulado" stroke={C.accent} strokeWidth={3} dot={{fill:C.accent,r:4,strokeWidth:2,stroke:C.bg}} activeDot={{r:7}} name="Acumulado"/>
              </LineChart>
            </ResponsiveContainer>
          </Card>
          :<Card><Empty icon="📈" msg="Dados insuficientes" sub="Adicione transações para ver a evolução"/></Card>
        }
        <Card>
          <div style={{color:C.text,fontWeight:700,marginBottom:14,fontSize:14}}>Distribuição</div>
          {distribuicao.length>0
            ?<>
              <ResponsiveContainer width="100%" height={150}>
                <PieChart><Pie data={distribuicao} dataKey="valor" cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={4}>{distribuicao.map((d,i)=><Cell key={i} fill={d.cor}/>)}</Pie><Tooltip formatter={v=>fmt(v)} contentStyle={{background:C.card,border:`1px solid ${C.border}`,fontSize:11}}/></PieChart>
              </ResponsiveContainer>
              <div style={{display:"flex",flexDirection:"column",gap:8,marginTop:8}}>
                {distribuicao.map((d,i)=>(
                  <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <div style={{display:"flex",alignItems:"center",gap:8}}><div style={{width:10,height:10,borderRadius:"50%",background:d.cor}}/><span style={{color:C.muted,fontSize:12}}>{d.nome}</span></div>
                    <div style={{textAlign:"right"}}><div style={{color:C.text,fontSize:12,fontWeight:700}}>{fmt(d.valor)}</div><div style={{color:C.muted,fontSize:10}}>{total>0?((d.valor/total)*100).toFixed(1):0}%</div></div>
                  </div>
                ))}
              </div>
            </>
            :<Empty icon="🏦" msg="Sem dados" sub="Adicione contas e ativos"/>
          }
        </Card>
      </div>

      {evolucao.length>=2&&(
        <Card>
          <div style={{color:C.text,fontWeight:700,marginBottom:14,fontSize:14}}>Resultado por Mês</div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={evolucao}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border}/>
              <XAxis dataKey="mes" tick={{fill:C.muted,fontSize:10}} axisLine={false} tickLine={false}/>
              <YAxis tick={{fill:C.muted,fontSize:9}} axisLine={false} tickLine={false} tickFormatter={v=>`${(v/1000).toFixed(1)}k`}/>
              <Tooltip content={<MiniTooltip/>}/>
              <Bar dataKey="resultado" radius={[4,4,0,0]} name="Resultado">{evolucao.map((d,i)=><Cell key={i} fill={d.resultado>=0?C.accent:C.red}/>)}</Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      {contas.length>0&&(
        <Card>
          <div style={{color:C.text,fontWeight:700,marginBottom:14,fontSize:14}}>Saldo por Conta</div>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {contas.map(c=>{
              const rec  = transacoes.filter(t=>t.tipo==="rec" &&t.conta===c.nome&&t.cat!=="Transferência").reduce((s,t)=>s+Number(t.valor),0);
              const desp = transacoes.filter(t=>t.tipo==="desp"&&t.conta===c.nome&&t.cat!=="Transferência").reduce((s,t)=>s+Number(t.valor),0);
              const transfsEnt = transacoes.filter(t=>t.tipo==="rec" &&t.conta===c.nome&&t.cat==="Transferência").reduce((s,t)=>s+Number(t.valor),0);
              const transfsSai = transacoes.filter(t=>t.tipo==="desp"&&t.conta===c.nome&&t.cat==="Transferência").reduce((s,t)=>s+Number(t.valor),0);
              const saldoReal = Number(c.saldo) + rec - desp + transfsEnt - transfsSai;
              const pct = saldoContas>0?(saldoReal/saldoContas)*100:0;
              return (
                <div key={c.id}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                    <div style={{display:"flex",alignItems:"center",gap:8}}><span style={{fontSize:16}}>{c.icon}</span><span style={{color:C.text,fontSize:13,fontWeight:600}}>{c.nome}</span><Badge color={c.cor||C.accent}>{c.tipo}</Badge></div>
                    <div style={{display:"flex",gap:12}}><span style={{color:C.muted,fontSize:12}}>{pct.toFixed(1)}%</span><span style={{color:c.cor||C.accent,fontWeight:700,fontFamily:"'DM Mono',monospace",fontSize:13}}>{fmt(saldoReal)}</span></div>
                  </div>
                  <div style={{background:C.border,borderRadius:4,height:5}}><div style={{background:c.cor||C.accent,height:"100%",width:`${Math.max(0,pct)}%`,borderRadius:4}}/></div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}

// ─── INVESTIMENTOS ────────────────────────────────────────────────────────────
function Investimentos({ ativos, setAtivos, loading }) {
  const [modal, setModal]         = useState(false);
  const [editModal, setEditModal] = useState(null);
  const [saving, setSaving]       = useState(false);
  const [novoPreco, setNovoPreco] = useState("");
  const [cotando, setCotando]     = useState(false);
  const [form, setForm]           = useState({ ticker:"", qtd:"", pmedio:"", atual:"", setor:"" });
  const f = k => v => setForm(p=>({...p,[k]:v}));

  const buscarCotacao = async (ticker) => {
    setCotando(true);
    try {
      const r = await fetch(`https://brapi.dev/api/quote/${ticker.toUpperCase()}?token=demo`);
      if (r.ok) { const data=await r.json(); const preco=data?.results?.[0]?.regularMarketPrice; if(preco){ setCotando(false); return preco.toFixed(2); } }
    } catch(e) {}
    setCotando(false); return null;
  };

  const salvar = async () => {
    if (!form.ticker||!form.qtd||!form.pmedio) return;
    setSaving(true);
    const novo = {...form, id:uid(), qtd:Number(form.qtd), pmedio:Number(form.pmedio), atual:Number(form.atual||form.pmedio)};
    setAtivos(p=>[...p,novo]);
    await db.insert("ativos", novo);
    setModal(false); setForm({ticker:"",qtd:"",pmedio:"",atual:"",setor:""}); setSaving(false);
  };

  const salvarPreco = async () => {
    if (!editModal||!novoPreco) return;
    setSaving(true);
    await db.update("ativos", editModal.id, { atual: Number(novoPreco) });
    setAtivos(p=>p.map(a=>a.id===editModal.id?{...a,atual:Number(novoPreco)}:a));
    setEditModal(null); setNovoPreco(""); setSaving(false);
  };

  const excluir = async id => { await db.remove("ativos",id); setAtivos(p=>p.filter(a=>a.id!==id)); };

  const carteira = ativos.map((a,i)=>({
    ...a, vinvest:Number(a.qtd)*Number(a.pmedio), vatual:Number(a.qtd)*Number(a.atual||a.pmedio),
    lucro:(Number(a.atual||a.pmedio)-Number(a.pmedio))*Number(a.qtd),
    pct:((Number(a.atual||a.pmedio)-Number(a.pmedio))/Number(a.pmedio))*100, cor:PALETTE[i%PALETTE.length]
  }));
  const totalInvest = carteira.reduce((s,a)=>s+a.vinvest,0);
  const totalAtual  = carteira.reduce((s,a)=>s+a.vatual,0);
  const lucroTotal  = totalAtual - totalInvest;

  if (loading) return <Spinner />;

  return (
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      <div className="grid-3col" style={{display:"grid",gap:12}}>
        <StatCard label="Total Investido" value={fmt(totalInvest)} color={C.blue}/>
        <StatCard label="Valor Atual"     value={fmt(totalAtual)}/>
        <StatCard label="Resultado"       value={fmt(lucroTotal)} color={lucroTotal>=0?C.accent:C.red} sub={totalInvest>0?fmtPct((lucroTotal/totalInvest)*100):""}/>
      </div>
      <div style={{display:"flex",justifyContent:"flex-end"}}><Btn small onClick={()=>setModal(true)}>+ Ativo</Btn></div>
      {carteira.length===0
        ?<Card><Empty icon="📈" msg="Carteira vazia" sub="Adicione ações e ETFs para acompanhar"/></Card>
        :<div style={{display:"flex",flexDirection:"column",gap:16}}>
          <Card style={{padding:0,overflowX:"auto"}}>
            <table style={{width:"100%",minWidth:700,borderCollapse:"collapse"}}>
              <thead><tr style={{borderBottom:`1px solid ${C.border}`}}>{["Ticker","Setor","Qtd","P.Médio","P.Atual","Investido","Atual","L/P","%",""].map((h,i)=><th key={i} style={{padding:"12px 14px",textAlign:"left",color:C.muted,fontSize:10,fontWeight:700,letterSpacing:1,textTransform:"uppercase",whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead>
              <tbody>
                {carteira.map((a,i)=>(
                  <tr key={a.id} style={{borderBottom:`1px solid ${C.border}22`,background:i%2===0?"transparent":C.surface+"44"}}>
                    <td style={{padding:"11px 14px"}}><Badge color={C.yellow}>{a.ticker}</Badge></td>
                    <td style={{padding:"11px 14px",color:C.muted,fontSize:12}}>{a.setor||"—"}</td>
                    <td style={{padding:"11px 14px",color:C.text,fontSize:12}}>{a.qtd}</td>
                    <td style={{padding:"11px 14px",color:C.text,fontSize:12,fontFamily:"'DM Mono',monospace"}}>R${Number(a.pmedio).toFixed(2)}</td>
                    <td style={{padding:"11px 14px"}}>
                      <div style={{display:"flex",alignItems:"center",gap:6}}>
                        <span style={{color:C.text,fontSize:12,fontFamily:"'DM Mono',monospace"}}>R${Number(a.atual||a.pmedio).toFixed(2)}</span>
                        <button onClick={()=>{setEditModal(a);setNovoPreco(String(a.atual||a.pmedio));}} style={{background:C.accentDim,border:`1px solid ${C.accentGlow}`,borderRadius:6,padding:"2px 7px",cursor:"pointer",color:C.accent,fontSize:10,fontWeight:700}}>✏️</button>
                      </div>
                    </td>
                    <td style={{padding:"11px 14px",color:C.muted,fontSize:12}}>{fmt(a.vinvest)}</td>
                    <td style={{padding:"11px 14px",color:C.text,fontSize:12}}>{fmt(a.vatual)}</td>
                    <td style={{padding:"11px 14px",color:a.lucro>=0?C.accent:C.red,fontFamily:"'DM Mono',monospace",fontSize:12}}>{fmt(a.lucro)}</td>
                    <td style={{padding:"11px 14px"}}><Badge color={a.pct>=0?C.accent:C.red}>{fmtPct(a.pct)}</Badge></td>
                    <td style={{padding:"11px 14px"}}><button onClick={()=>excluir(a.id)} style={{background:"none",border:"none",color:C.muted,cursor:"pointer"}}>🗑</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          {carteira.length>1&&(
            <Card>
              <div style={{color:C.text,fontWeight:700,marginBottom:12,fontSize:14}}>Alocação da Carteira</div>
              <div style={{display:"flex",gap:16,alignItems:"center"}}>
                <div style={{flexShrink:0,width:120,height:120}}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart><Pie data={carteira} dataKey="vatual" cx="50%" cy="50%" innerRadius={30} outerRadius={55} paddingAngle={3}>{carteira.map((a,i)=><Cell key={i} fill={a.cor}/>)}</Pie><Tooltip formatter={v=>fmt(v)} contentStyle={{background:C.card,border:`1px solid ${C.border}`,fontSize:11}}/></PieChart>
                  </ResponsiveContainer>
                </div>
                <div style={{flex:1,display:"flex",flexDirection:"column",gap:6}}>
                  {carteira.map((a,i)=>(
                    <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                      <div style={{display:"flex",alignItems:"center",gap:6}}><div style={{width:8,height:8,borderRadius:"50%",background:a.cor,flexShrink:0}}/><span style={{color:C.muted,fontSize:12}}>{a.ticker}</span></div>
                      <div style={{textAlign:"right"}}><div style={{color:C.text,fontSize:12,fontWeight:700}}>{totalAtual>0?((a.vatual/totalAtual)*100).toFixed(1):0}%</div><div style={{color:C.muted,fontSize:10}}>{fmt(a.vatual)}</div></div>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          )}
        </div>
      }
      {modal&&(
        <Modal title="Novo Ativo" onClose={()=>setModal(false)}>
          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            <InputField label="Ticker (Ação ou ETF)" value={form.ticker} onChange={f("ticker")} placeholder="Ex: PETR4, BOVA11"/>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              <InputField label="Quantidade" value={form.qtd} onChange={f("qtd")} type="number" placeholder="0"/>
              <InputField label="Preço Médio" value={form.pmedio} onChange={f("pmedio")} type="number" placeholder="0,00"/>
            </div>
            <div style={{display:"flex",gap:8,alignItems:"flex-end"}}>
              <div style={{flex:1}}><InputField label="Preço Atual (opcional)" value={form.atual} onChange={f("atual")} type="number" placeholder="Vazio = igual ao médio"/></div>
              <Btn small outline onClick={async()=>{ if(!form.ticker) return; const p=await buscarCotacao(form.ticker); if(p) f("atual")(p); else alert("Não encontrado."); }}>{cotando?"...":"🔄"}</Btn>
            </div>
            <InputField label="Setor" value={form.setor} onChange={f("setor")} placeholder="Ex: Energia, ETF"/>
            <Btn onClick={salvar} full>{saving?"Salvando...":"Salvar"}</Btn>
          </div>
        </Modal>
      )}
      {editModal&&(
        <Modal title={`Atualizar Preço — ${editModal.ticker}`} onClose={()=>setEditModal(null)}>
          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            <div style={{background:C.surface,borderRadius:10,padding:"12px 14px"}}>
              <div style={{color:C.muted,fontSize:11}}>Preço atual registrado</div>
              <div style={{color:C.text,fontWeight:700,fontFamily:"'DM Mono',monospace",fontSize:18}}>R$ {Number(editModal.atual||editModal.pmedio).toFixed(2)}</div>
            </div>
            <div style={{display:"flex",gap:8,alignItems:"flex-end"}}>
              <div style={{flex:1}}><InputField label="Novo Preço (R$)" value={novoPreco} onChange={setNovoPreco} type="number" placeholder="0,00"/></div>
              <Btn small outline onClick={async()=>{ const p=await buscarCotacao(editModal.ticker); if(p) setNovoPreco(p); else alert("Não encontrado."); }}>{cotando?"...":"🔄"}</Btn>
            </div>
            <Btn onClick={salvarPreco} full>{saving?"Salvando...":"Atualizar Preço"}</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── RELATÓRIOS ───────────────────────────────────────────────────────────────
function Relatorios({ transacoes, ativos, loading }) {
  const now=new Date(); const mesN=now.getMonth()+1, anoN=now.getFullYear();
  const doMes = transacoes.filter(t=>{ const {m,a}=getMesAno(t.data); return m===mesN&&a===anoN; });
  const doAno = transacoes.filter(t=>getMesAno(t.data).a===anoN);
  const recMes  = doMes.filter(t=>t.tipo==="rec" &&t.cat!=="Transferência").reduce((s,t)=>s+Number(t.valor),0);
  const despMes = doMes.filter(t=>t.tipo==="desp"&&t.cat!=="Transferência").reduce((s,t)=>s+Number(t.valor),0);
  const recAno  = doAno.filter(t=>t.tipo==="rec" &&t.cat!=="Transferência").reduce((s,t)=>s+Number(t.valor),0);
  const despAno = doAno.filter(t=>t.tipo==="desp"&&t.cat!=="Transferência").reduce((s,t)=>s+Number(t.valor),0);
  const catDesp={}; doMes.filter(t=>t.tipo==="desp"&&t.cat!=="Transferência").forEach(t=>{catDesp[t.cat||"Outros"]=(catDesp[t.cat||"Outros"]||0)+Number(t.valor);});
  const topCat=Object.entries(catDesp).sort((a,b)=>b[1]-a[1]);
  const totalAtual  = ativos.reduce((s,a)=>s+Number(a.atual||a.pmedio)*Number(a.qtd),0);
  const totalInvest = ativos.reduce((s,a)=>s+Number(a.pmedio)*Number(a.qtd),0);
  const Row = ({label,val,cor=C.text}) => (
    <div style={{display:"flex",justifyContent:"space-between",padding:"9px 0",borderBottom:`1px solid ${C.border}`,flexWrap:"wrap",gap:4}}>
      <span style={{color:C.muted,fontSize:12}}>{label}</span>
      <span style={{color:cor,fontWeight:700,fontFamily:"'DM Mono',monospace",fontSize:12}}>{val}</span>
    </div>
  );
  if (loading) return <Spinner />;
  return (
    <div className="grid-2col" style={{display:"grid",gap:16}}>
      <Card>
        <div style={{color:C.text,fontWeight:700,marginBottom:14,fontSize:14}}>📅 Mês Atual</div>
        <Row label="Receitas"         val={fmt(recMes)}  cor={C.accent}/>
        <Row label="Despesas"         val={fmt(despMes)} cor={C.red}/>
        <Row label="Resultado"        val={fmt(recMes-despMes)} cor={recMes-despMes>=0?C.accent:C.red}/>
        <Row label="Taxa de Poupança" val={recMes>0?`${(((recMes-despMes)/recMes)*100).toFixed(1)}%`:"—"} cor={C.yellow}/>
        <Row label="Transações"       val={String(doMes.filter(t=>t.cat!=="Transferência").length)}/>
      </Card>
      <Card>
        <div style={{color:C.text,fontWeight:700,marginBottom:14,fontSize:14}}>📆 Ano Atual</div>
        <Row label="Receitas"   val={fmt(recAno)}         cor={C.accent}/>
        <Row label="Despesas"   val={fmt(despAno)}        cor={C.red}/>
        <Row label="Resultado"  val={fmt(recAno-despAno)} cor={recAno-despAno>=0?C.accent:C.red}/>
        <Row label="Transações" val={String(doAno.filter(t=>t.cat!=="Transferência").length)}/>
      </Card>
      <Card style={{gridColumn:"span 2"}}>
        <div style={{color:C.text,fontWeight:700,marginBottom:14,fontSize:14}}>📊 Investimentos</div>
        <Row label="Total Investido"    val={fmt(totalInvest)}            cor={C.blue}/>
        <Row label="Valor Atual"        val={fmt(totalAtual)}/>
        <Row label="Resultado Carteira" val={fmt(totalAtual-totalInvest)} cor={totalAtual-totalInvest>=0?C.accent:C.red}/>
      </Card>
      {topCat.length>0&&(
        <Card style={{gridColumn:"span 2"}}>
          <div style={{color:C.text,fontWeight:700,marginBottom:14,fontSize:14}}>🏷 Gastos por Categoria (mês)</div>
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {topCat.map(([cat,val],i)=>{ const pct=despMes>0?(val/despMes)*100:0; return (
              <div key={i}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span style={{color:C.text,fontSize:13}}>{cat}</span><span style={{color:C.muted,fontSize:12}}>{fmt(val)} · {pct.toFixed(1)}%</span></div>
                <div style={{background:C.border,borderRadius:4,height:6}}><div style={{background:PALETTE[i%PALETTE.length],height:"100%",width:`${pct}%`,borderRadius:4}}/></div>
              </div>
            ); })}
          </div>
        </Card>
      )}
    </div>
  );
}

// ─── CONFIGURAÇÕES ────────────────────────────────────────────────────────────
function Configuracoes({ cats, setCats, contas, setContas, loading }) {
  const [tab, setTab]               = useState("contas");
  const [modalCat, setModalCat]     = useState(null);
  const [modalSub, setModalSub]     = useState(null);
  const [modalConta, setModalConta] = useState(false);
  const [editSaldo, setEditSaldo]   = useState(null);
  const [novoSaldo, setNovoSaldo]   = useState("");
  const [nomeCat, setNomeCat]       = useState("");
  const [nomeSub, setNomeSub]       = useState("");
  const [saving, setSaving]         = useState(false);
  const [formConta, setFormConta]   = useState({ nome:"", saldo:"", tipo:"Conta Corrente", icon:"🏦" });
  const fc = k => v => setFormConta(p=>({...p,[k]:v}));

  const addCat = async tipo => {
    if (!nomeCat.trim()) return; setSaving(true);
    const nova = {id:uid(), nome:nomeCat.trim(), subs:[]};
    setCats(p=>({...p,[tipo]:[...p[tipo],nova]}));
    await db.insert("cats", {...nova, tipo, subs:JSON.stringify([])});
    setNomeCat(""); setModalCat(null); setSaving(false);
  };
  const delCat = async (tipo,id) => {
    setCats(p=>({...p,[tipo]:p[tipo].filter(c=>c.id!==id)}));
    await db.remove("cats",id);
  };
  const addSub = async (tipo,catId) => {
    if (!nomeSub.trim()) return; setSaving(true);
    const cat=cats[tipo].find(c=>c.id===catId);
    const newSubs=[...cat.subs,nomeSub.trim()];
    setCats(p=>({...p,[tipo]:p[tipo].map(c=>c.id===catId?{...c,subs:newSubs}:c)}));
    await db.update("cats",catId,{subs:JSON.stringify(newSubs)});
    setNomeSub(""); setModalSub(null); setSaving(false);
  };
  const delSub = async (tipo,catId,sub) => {
    const cat=cats[tipo].find(c=>c.id===catId);
    const newSubs=cat.subs.filter(s=>s!==sub);
    setCats(p=>({...p,[tipo]:p[tipo].map(c=>c.id===catId?{...c,subs:newSubs}:c)}));
    await db.update("cats",catId,{subs:JSON.stringify(newSubs)});
  };
  const addConta = async () => {
    if (!formConta.nome) return; setSaving(true);
    const nova = {id:uid(), nome:formConta.nome, tipo:formConta.tipo, icon:formConta.icon, saldo:Number(formConta.saldo||0), cor:PALETTE[contas.length%PALETTE.length]};
    setContas(p=>[...p,nova]);
    await db.insert("contas", nova);
    setFormConta({nome:"",saldo:"",tipo:"Conta Corrente",icon:"🏦"});
    setModalConta(false); setSaving(false);
  };
  const delConta = async id => {
    setContas(p=>p.filter(c=>c.id!==id));
    await db.remove("contas",id);
  };
  const salvarSaldo = async () => {
    if (!editSaldo) return; setSaving(true);
    await db.update("contas",editSaldo.id,{saldo:Number(novoSaldo)});
    setContas(p=>p.map(c=>c.id===editSaldo.id?{...c,saldo:Number(novoSaldo)}:c));
    setEditSaldo(null); setNovoSaldo(""); setSaving(false);
  };

  const TABS = [{id:"contas",label:"Contas",icon:"🏦"},{id:"cat-desp",label:"Despesas",icon:"📤"},{id:"cat-rec",label:"Receitas",icon:"📥"}];
  const tipo = tab==="cat-rec"?"rec":"desp";

  if (loading) return <Spinner />;

  return (
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      <div style={{display:"flex",background:C.surface,borderRadius:12,padding:4,gap:2}}>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{flex:1,padding:"9px 4px",borderRadius:9,border:"none",cursor:"pointer",background:tab===t.id?C.card:"transparent",color:tab===t.id?C.text:C.muted,fontWeight:tab===t.id?700:500,fontSize:12,fontFamily:"inherit",display:"flex",flexDirection:"column",alignItems:"center",gap:3,boxShadow:tab===t.id?`0 0 0 1px ${C.border}`:"none"}}>
            <span style={{fontSize:16}}>{t.icon}</span><span>{t.label}</span>
          </button>
        ))}
      </div>

      {tab==="contas"&&(
        <>
          <div style={{display:"flex",justifyContent:"flex-end"}}><Btn small onClick={()=>setModalConta(true)}>+ Conta</Btn></div>
          {contas.length===0
            ?<Card><Empty icon="🏦" msg="Nenhuma conta" sub="Adicione suas contas bancárias"/></Card>
            :contas.map(c=>(
              <Card key={c.id} style={{borderColor:(c.cor||C.accent)+"44"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div style={{display:"flex",alignItems:"center",gap:12}}>
                    <div style={{width:44,height:44,background:(c.cor||C.accent)+"22",borderRadius:12,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22}}>{c.icon}</div>
                    <div><div style={{color:C.text,fontWeight:700,fontSize:15}}>{c.nome}</div><Badge color={c.cor||C.accent}>{c.tipo}</Badge></div>
                  </div>
                  <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:6}}>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <div style={{color:c.cor||C.accent,fontSize:18,fontWeight:900,fontFamily:"'DM Mono',monospace"}}>{fmt(c.saldo)}</div>
                      <button onClick={()=>{setEditSaldo(c);setNovoSaldo(String(c.saldo));}} style={{background:C.accentDim,border:`1px solid ${C.accentGlow}`,borderRadius:7,padding:"4px 10px",cursor:"pointer",color:C.accent,fontSize:11,fontWeight:700}}>✏️</button>
                    </div>
                    <button onClick={()=>delConta(c.id)} style={{background:C.red+"18",border:`1px solid ${C.red}33`,color:C.red,borderRadius:7,padding:"4px 10px",cursor:"pointer",fontSize:11,fontWeight:700}}>Remover</button>
                  </div>
                </div>
              </Card>
            ))
          }
        </>
      )}

      {(tab==="cat-desp"||tab==="cat-rec")&&(
        <>
          <div style={{display:"flex",justifyContent:"flex-end"}}><Btn small onClick={()=>setModalCat(tipo)}>+ Categoria</Btn></div>
          {cats[tipo].length===0&&<Card><Empty icon="🏷" msg="Nenhuma categoria" sub="Adicione usando o botão acima"/></Card>}
          {cats[tipo].map(cat=>(
            <Card key={cat.id}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:cat.subs.length>0?12:0}}>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <div style={{width:8,height:8,borderRadius:"50%",background:tipo==="desp"?C.red:C.accent}}/>
                  <span style={{color:C.text,fontWeight:700,fontSize:14}}>{cat.nome}</span>
                  <span style={{color:C.muted,fontSize:11}}>{cat.subs.length} subs</span>
                </div>
                <div style={{display:"flex",gap:6}}>
                  <Btn small outline onClick={()=>setModalSub({tipo,catId:cat.id})}>+ Sub</Btn>
                  <button onClick={()=>delCat(tipo,cat.id)} style={{background:C.red+"18",border:`1px solid ${C.red}33`,color:C.red,borderRadius:8,padding:"5px 10px",cursor:"pointer",fontSize:12,fontWeight:700}}>✕</button>
                </div>
              </div>
              {cat.subs.length>0&&(
                <div style={{display:"flex",flexWrap:"wrap",gap:7,paddingTop:8,borderTop:`1px solid ${C.border}`}}>
                  {cat.subs.map(sub=>(
                    <div key={sub} style={{display:"flex",alignItems:"center",gap:5,background:C.surface,border:`1px solid ${C.border}`,borderRadius:20,padding:"4px 10px 4px 12px"}}>
                      <span style={{color:C.text,fontSize:12}}>{sub}</span>
                      <button onClick={()=>delSub(tipo,cat.id,sub)} style={{background:"none",border:"none",color:C.muted,cursor:"pointer",fontSize:13,padding:"0 0 0 2px"}}>×</button>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          ))}
        </>
      )}

      {modalCat&&<Modal title={`Nova Categoria — ${modalCat==="rec"?"Receita":"Despesa"}`} onClose={()=>{setModalCat(null);setNomeCat("");}}><div style={{display:"flex",flexDirection:"column",gap:14}}><InputField label="Nome" value={nomeCat} onChange={setNomeCat} placeholder="Ex: Moradia"/><Btn onClick={()=>addCat(modalCat)} full>{saving?"Salvando...":"Adicionar"}</Btn></div></Modal>}
      {modalSub&&<Modal title={`Nova Subcategoria — ${cats[modalSub.tipo].find(c=>c.id===modalSub.catId)?.nome}`} onClose={()=>{setModalSub(null);setNomeSub("");}}><div style={{display:"flex",flexDirection:"column",gap:14}}><InputField label="Nome" value={nomeSub} onChange={setNomeSub} placeholder="Ex: Aluguel"/><Btn onClick={()=>addSub(modalSub.tipo,modalSub.catId)} full>{saving?"Salvando...":"Adicionar"}</Btn></div></Modal>}
      {editSaldo&&(<Modal title={`Editar Saldo — ${editSaldo.nome}`} onClose={()=>setEditSaldo(null)}><div style={{display:"flex",flexDirection:"column",gap:14}}><InputField label="Novo Saldo (R$)" value={novoSaldo} onChange={setNovoSaldo} type="number" placeholder="0,00"/><Btn onClick={salvarSaldo} full>{saving?"Salvando...":"Salvar"}</Btn></div></Modal>)}
      {modalConta&&(
        <Modal title="Nova Conta" onClose={()=>{setModalConta(false);setFormConta({nome:"",saldo:"",tipo:"Conta Corrente",icon:"🏦"});}}>
          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            <InputField label="Nome" value={formConta.nome} onChange={fc("nome")} placeholder="Ex: Nubank"/>
            <InputField label="Tipo" value={formConta.tipo} onChange={fc("tipo")} options={["Conta Corrente","Poupança","Corretora","Carteira"]}/>
            <InputField label="Emoji" value={formConta.icon} onChange={fc("icon")} placeholder="🏦"/>
            <InputField label="Saldo Inicial (R$)" value={formConta.saldo} onChange={fc("saldo")} type="number" placeholder="0,00"/>
            <Btn onClick={addConta} full>{saving?"Salvando...":"Salvar"}</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── NAV & APP ────────────────────────────────────────────────────────────────
const NAV = [
  { id:"dashboard",     label:"Início",        icon:"◈", desc:"Resumo do mês" },
  { id:"transacoes",    label:"Transações",    icon:"⇄", desc:"Receitas e despesas" },
  { id:"patrimonio",    label:"Patrimônio",    icon:"▲", desc:"Evolução e distribuição" },
  { id:"investimentos", label:"Carteira",      icon:"◆", desc:"Ações e ETFs" },
  { id:"relatorios",    label:"Relatórios",    icon:"≡", desc:"Análises" },
  { id:"config",        label:"Configurações", icon:"⚙", desc:"Contas e categorias" },
];

export default function App() {
  const [screen, setScreen]         = useState("dashboard");
  const [transacoes, setTransacoes] = useState([]);
  const [contas, setContas]         = useState([]);
  const [ativos, setAtivos]         = useState([]);
  const [cats, setCats]             = useState(DEFAULT_CATS);
  const [loading, setLoading]       = useState(true);
  const isDesktop                   = useIsDesktop();

  useEffect(()=>{
    async function fetchAll() {
      setLoading(true);
      try {
        const [t,c,a,ct] = await Promise.all([
          db.get("transacoes"), db.get("contas"), db.get("ativos"), db.get("cats"),
        ]);
        setTransacoes(t||[]);
        setContas(c||[]);
        setAtivos(a||[]);
        if (ct?.length>0) {
          const rebuilt={rec:[],desp:[]};
          ct.forEach(row=>{ if(row.tipo==="rec"||row.tipo==="desp") rebuilt[row.tipo].push({id:row.id,nome:row.nome,subs:Array.isArray(row.subs)?row.subs:(typeof row.subs==="string"?JSON.parse(row.subs):[])}); });
          if (rebuilt.rec.length>0||rebuilt.desp.length>0) setCats(rebuilt);
        }
      } catch(e) { console.error("fetchAll:",e); }
      finally { setLoading(false); }
    }
    fetchAll();
  },[]);

  const cur   = NAV.find(n=>n.id===screen);
  const props = { transacoes, contas, ativos, cats, loading };

  const renderScreen = () => {
    switch(screen) {
      case "dashboard":     return <Dashboard     {...props} setTransacoes={setTransacoes} setContas={setContas}/>;
      case "transacoes":    return <Transacoes    {...props} setTransacoes={setTransacoes}/>;
      case "patrimonio":    return <Patrimonio    {...props}/>;
      case "investimentos": return <Investimentos {...props} setAtivos={setAtivos}/>;
      case "relatorios":    return <Relatorios    {...props}/>;
      case "config":        return <Configuracoes {...props} setCats={setCats} setContas={setContas}/>;
      default:              return <Dashboard     {...props} setTransacoes={setTransacoes} setContas={setContas}/>;
    }
  };

  const styles = `
    @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800;900&family=DM+Mono:wght@400;500;700&display=swap');
    * { box-sizing:border-box; margin:0; padding:0; }
    input,select { color-scheme:dark; }
    input[type=number]::-webkit-inner-spin-button { -webkit-appearance:none; }
    ::-webkit-scrollbar { width:6px; height:6px; }
    ::-webkit-scrollbar-track { background:transparent; }
    ::-webkit-scrollbar-thumb { background:${C.border}; border-radius:3px; }
    .grid-2col { grid-template-columns: 1fr 1fr; }
    .grid-3col { grid-template-columns: repeat(3,1fr); }
    @media (max-width: 640px) {
      .grid-2col { grid-template-columns: 1fr !important; }
      .grid-3col { grid-template-columns: 1fr 1fr !important; }
    }
    button { transition:all 0.15s; }
    button:active { opacity:0.7; }
    input:focus,select:focus { border-color:${C.accent} !important; outline:none; }
    @keyframes spin { to { transform:rotate(360deg); } }
  `;

  if (isDesktop) return (
    <div style={{display:"flex",height:"100vh",background:C.bg,fontFamily:"'Outfit','DM Sans',sans-serif",color:C.text,overflow:"hidden"}}>
      <div style={{width:240,background:C.surface,borderRight:`1px solid ${C.border}`,display:"flex",flexDirection:"column",flexShrink:0,height:"100vh"}}>
        <div style={{padding:"24px 20px 20px",borderBottom:`1px solid ${C.border}`}}>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <div style={{width:36,height:36,background:`linear-gradient(135deg, ${C.accent}, ${C.blue})`,borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,fontWeight:900}}>₿</div>
            <div><div style={{color:C.text,fontWeight:900,fontSize:16}}>FinControl</div><div style={{color:C.muted,fontSize:10}}>Gestão Financeira</div></div>
          </div>
        </div>
        <nav style={{flex:1,padding:"12px 10px",display:"flex",flexDirection:"column",gap:2,overflowY:"auto"}}>
          {NAV.map(n=>{ const active=screen===n.id; return (
            <button key={n.id} onClick={()=>setScreen(n.id)} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 12px",borderRadius:10,border:"none",cursor:"pointer",width:"100%",textAlign:"left",background:active?C.accentDim:"transparent",borderLeft:`3px solid ${active?C.accent:"transparent"}`,fontFamily:"inherit"}}>
              <span style={{fontSize:18,lineHeight:1,opacity:active?1:0.6}}>{n.icon}</span>
              <div><div style={{color:active?C.accent:C.text,fontWeight:active?700:500,fontSize:13}}>{n.label}</div><div style={{color:C.muted,fontSize:10,marginTop:1}}>{n.desc}</div></div>
            </button>
          ); })}
        </nav>
        <div style={{padding:"16px 20px",borderTop:`1px solid ${C.border}`,display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:34,height:34,borderRadius:"50%",background:`linear-gradient(135deg, ${C.purple}, ${C.blue})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:800,color:"#fff"}}>L</div>
          <div style={{flex:1}}><div style={{color:C.text,fontSize:13,fontWeight:700}}>Luan</div><div style={{color:C.muted,fontSize:10}}>Conta pessoal</div></div>
          {loading&&<div style={{width:14,height:14,border:`2px solid ${C.border}`,borderTopColor:C.accent,borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>}
        </div>
      </div>
      <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
        <div style={{height:62,background:C.surface,borderBottom:`1px solid ${C.border}`,display:"flex",alignItems:"center",padding:"0 28px",gap:14,flexShrink:0}}>
          <div><h1 style={{margin:0,color:C.text,fontWeight:800,fontSize:18}}>{cur?.label}</h1><div style={{color:C.muted,fontSize:11}}>{cur?.desc}</div></div>
          <div style={{marginLeft:"auto"}}><div style={{background:C.accentDim,border:`1px solid ${C.accentGlow}`,borderRadius:8,padding:"5px 14px",color:C.accent,fontSize:12,fontWeight:700}}>{mesAtual()}</div></div>
        </div>
        <div style={{flex:1,overflowY:"auto",padding:"24px 28px"}}>{renderScreen()}</div>
      </div>
      <style>{styles}</style>
    </div>
  );

  return (
    <div style={{background:C.bg,minHeight:"100vh",fontFamily:"'Outfit','DM Sans',sans-serif",color:C.text,display:"flex",flexDirection:"column",maxWidth:640,margin:"0 auto"}}>
      <div style={{position:"sticky",top:0,zIndex:50,background:C.surface,borderBottom:`1px solid ${C.border}`,display:"flex",alignItems:"center",padding:"12px 18px",gap:10}}>
        <div style={{width:30,height:30,background:`linear-gradient(135deg, ${C.accent}, ${C.blue})`,borderRadius:9,display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,fontWeight:900}}>₿</div>
        <div><div style={{color:C.text,fontWeight:800,fontSize:15}}>FinControl</div><div style={{color:C.muted,fontSize:10}}>{cur?.label}</div></div>
        <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:8}}>
          {loading&&<div style={{width:16,height:16,border:`2px solid ${C.border}`,borderTopColor:C.accent,borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>}
          <div style={{background:C.accentDim,border:`1px solid ${C.accentGlow}`,borderRadius:7,padding:"4px 10px",color:C.accent,fontSize:11,fontWeight:700}}>{mesAtual()}</div>
        </div>
      </div>
      <div style={{flex:1,padding:"16px 14px 90px"}}>{renderScreen()}</div>
      <div style={{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:640,background:C.surface,borderTop:`1px solid ${C.border}`,display:"flex",padding:"8px 2px 14px",zIndex:50}}>
        {NAV.map(n=>(
          <button key={n.id} onClick={()=>setScreen(n.id)} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:3,background:"none",border:"none",cursor:"pointer",padding:"4px 1px",color:screen===n.id?C.accent:C.muted,fontFamily:"inherit"}}>
            <div style={{width:screen===n.id?28:0,height:2,background:C.accent,borderRadius:1,marginBottom:2,transition:"width 0.2s"}}/>
            <span style={{fontSize:15,lineHeight:1}}>{n.icon}</span>
            <span style={{fontSize:9,fontWeight:screen===n.id?700:500}}>{n.label}</span>
          </button>
        ))}
      </div>
      <style>{styles}</style>
    </div>
  );
}
