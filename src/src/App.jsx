import { useState, useMemo, useEffect, useCallback } from "react";
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

// ─── SUPABASE CONFIG ──────────────────────────────────────────────────────────
const SUPA_URL = "https://eoajfzjugksyvlftccvb.supabase.co";
const SUPA_KEY = "sb_publishable_YTGd2kRXpAwydD5c5aHLAw_bFI2_Z4X";
const USER_ID  = "luan"; // identificador fixo — mude se quiser

const db = {
  async get(table) {
    const r = await fetch(`${SUPA_URL}/rest/v1/${table}?user_id=eq.${USER_ID}&order=created_at.desc`, {
      headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` }
    });
    return r.ok ? r.json() : [];
  },
  async insert(table, row) {
    await fetch(`${SUPA_URL}/rest/v1/${table}`, {
      method: "POST",
      headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}`, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ ...row, user_id: USER_ID })
    });
  },
  async remove(table, id) {
    await fetch(`${SUPA_URL}/rest/v1/${table}?id=eq.${id}&user_id=eq.${USER_ID}`, {
      method: "DELETE",
      headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` }
    });
  },
  async update(table, id, row) {
    await fetch(`${SUPA_URL}/rest/v1/${table}?id=eq.${id}&user_id=eq.${USER_ID}`, {
      method: "PATCH",
      headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(row)
    });
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
const ESTRATEGIAS = ["Rompimento", "Suporte", "Resistência", "Tendência", "Reversão", "Scalp", "Outro"];

const DEFAULT_CATS = {
  rec: [
    { id: "r1", nome: "Salário",       subs: ["CLT", "PJ"] },
    { id: "r2", nome: "Freelance",     subs: ["Design", "Dev", "Consultoria"] },
    { id: "r3", nome: "Dividendos",    subs: ["Ações", "FIIs", "Exterior"] },
    { id: "r4", nome: "Outros Ganhos", subs: ["Vendas", "Reembolso", "Presente"] },
  ],
  desp: [
    { id: "d1", nome: "Moradia",       subs: ["Aluguel", "Condomínio", "IPTU", "Luz", "Água", "Internet"] },
    { id: "d2", nome: "Alimentação",   subs: ["Supermercado", "Restaurante", "Delivery", "Padaria"] },
    { id: "d3", nome: "Transporte",    subs: ["Combustível", "Uber", "Ônibus", "IPVA", "Seguro Auto"] },
    { id: "d4", nome: "Lazer",         subs: ["Cinema", "Viagem", "Jogos", "Academia", "Esporte"] },
    { id: "d5", nome: "Saúde",         subs: ["Consulta", "Remédio", "Plano de Saúde", "Dentista"] },
    { id: "d6", nome: "Assinaturas",   subs: ["Streaming", "Software", "Clube", "Revista"] },
    { id: "d7", nome: "Educação",      subs: ["Curso", "Livro", "Faculdade", "Idioma"] },
    { id: "d8", nome: "Investimentos", subs: ["Ações", "FIIs", "Renda Fixa", "Cripto"] },
    { id: "d9", nome: "Outros",        subs: [] },
  ],
};

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const fmt    = v => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v) || 0);
const fmtPct = v => `${Number(v) > 0 ? "+" : ""}${Number(v).toFixed(2)}%`;
const uid    = () => Math.random().toString(36).slice(2, 10);
const hoje   = () => new Date().toISOString().slice(0, 10);
const mesAtual = () => { const d = new Date(); return `${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear()}`; };

// ─── BASE COMPONENTS ──────────────────────────────────────────────────────────
const Card = ({ children, style = {} }) => (
  <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 16, ...style }}>{children}</div>
);
const Badge = ({ children, color = C.accent }) => (
  <span style={{ background: color+"22", color, border: `1px solid ${color}44`, borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 700 }}>{children}</span>
);
const Btn = ({ children, onClick, color = C.accent, outline = false, small = false, full = false, danger = false, style = {} }) => (
  <button onClick={onClick} style={{
    padding: small ? "7px 14px" : "9px 18px", borderRadius: 9,
    border: outline ? `1px solid ${danger ? C.red : color}` : "none",
    background: danger ? C.red+"22" : outline ? "transparent" : color,
    color: danger ? C.red : outline ? color : C.bg,
    fontWeight: 700, fontSize: small ? 12 : 13, cursor: "pointer",
    width: full ? "100%" : "auto", fontFamily: "inherit", ...style
  }}>{children}</button>
);
const InputField = ({ label, value, onChange, type = "text", placeholder = "", options = null }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
    {label && <label style={{ color: C.muted, fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>{label}</label>}
    {options ? (
      <select value={value} onChange={e => onChange(e.target.value)} style={{
        background: C.surface, border: `1px solid ${C.border}`, borderRadius: 9, padding: "10px 12px",
        color: value ? C.text : C.muted, fontSize: 13, outline: "none", fontFamily: "inherit", WebkitAppearance: "none",
      }}>
        <option value="">Selecionar...</option>
        {options.map((o,i) => <option key={i} value={o}>{o}</option>)}
      </select>
    ) : (
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={{
        background: C.surface, border: `1px solid ${C.border}`, borderRadius: 9, padding: "10px 12px",
        color: C.text, fontSize: 13, outline: "none", fontFamily: "inherit", width: "100%",
      }} />
    )}
  </div>
);
const Modal = ({ title, onClose, children }) => (
  <div onClick={e => e.target === e.currentTarget && onClose()}
    style={{ position: "fixed", inset: 0, background: "#000b", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 1000 }}>
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: "18px 18px 0 0", width: "100%", maxWidth: 600, maxHeight: "90vh", overflow: "auto", padding: 22 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <h3 style={{ margin: 0, color: C.text, fontWeight: 800, fontSize: 16 }}>{title}</h3>
        <button onClick={onClose} style={{ background: C.subtle, border: "none", color: C.muted, borderRadius: 8, width: 30, height: 30, cursor: "pointer", fontSize: 18, lineHeight: 1 }}>×</button>
      </div>
      {children}
    </div>
  </div>
);
const Empty = ({ icon, msg, sub }) => (
  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "36px 20px", gap: 8 }}>
    <div style={{ fontSize: 36, opacity: 0.25 }}>{icon}</div>
    <div style={{ color: C.muted, fontWeight: 700, fontSize: 14 }}>{msg}</div>
    {sub && <div style={{ color: C.muted, fontSize: 12, opacity: 0.6, textAlign: "center" }}>{sub}</div>}
  </div>
);
const Spinner = () => (
  <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
    <div style={{ width: 28, height: 28, border: `3px solid ${C.border}`, borderTopColor: C.accent, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
  </div>
);
const MiniTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "8px 14px", fontSize: 12 }}>
      <div style={{ color: C.muted, marginBottom: 4 }}>{label}</div>
      {payload.map((p, i) => <div key={i} style={{ color: p.color || C.text, fontWeight: 700 }}>{fmt(p.value)}</div>)}
    </div>
  );
};
const SectionTitle = ({ children }) => (
  <div style={{ color: C.muted, fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", padding: "4px 0 8px" }}>{children}</div>
);

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
function Dashboard({ transacoes, contas, ativos, loading }) {
  const now = new Date();
  const mesN = now.getMonth() + 1, anoN = now.getFullYear();
  const doMes = transacoes.filter(t => { const d = new Date(t.data); return d.getMonth()+1 === mesN && d.getFullYear() === anoN; });
  const recMes  = doMes.filter(t => t.tipo === "rec").reduce((s,t) => s + Number(t.valor), 0);
  const despMes = doMes.filter(t => t.tipo === "desp").reduce((s,t) => s + Number(t.valor), 0);
  const resultado = recMes - despMes;
  const poupanca  = recMes > 0 ? ((resultado / recMes) * 100).toFixed(1) : 0;
  const saldoContas = contas.filter(c => c.tipo !== "Cartão Crédito").reduce((s,c) => s + Number(c.saldo), 0);
  const valorAtivos = ativos.reduce((s,a) => s + Number(a.atual||a.pmedio) * Number(a.qtd), 0);
  const total = saldoContas + valorAtivos;

  const patByMonth = useMemo(() => {
    const meses = {};
    transacoes.forEach(t => {
      const d = new Date(t.data);
      const key = `${String(d.getMonth()+1).padStart(2,"0")}/${String(d.getFullYear()).slice(2)}`;
      if (!meses[key]) meses[key] = { rec: 0, desp: 0 };
      if (t.tipo === "rec")  meses[key].rec  += Number(t.valor);
      if (t.tipo === "desp") meses[key].desp += Number(t.valor);
    });
    return Object.entries(meses).slice(-5).map(([mes, v]) => ({ mes, ...v }));
  }, [transacoes]);

  const gastosCat = useMemo(() => {
    const map = {};
    transacoes.filter(t => t.tipo === "desp").forEach(t => { map[t.cat||"Outros"] = (map[t.cat||"Outros"]||0) + Number(t.valor); });
    return Object.entries(map).map(([nome, valor], i) => ({ nome, valor, cor: PALETTE[i % PALETTE.length] })).sort((a,b) => b.valor - a.valor).slice(0,6);
  }, [transacoes]);

  const ultimas  = [...transacoes].sort((a,b) => new Date(b.data) - new Date(a.data)).slice(0,5);
  const proximas = transacoes.filter(t => t.tipo === "desp" && t.status === "pendente").sort((a,b) => new Date(a.data) - new Date(b.data)).slice(0,4);

  if (loading) return <Spinner />;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <Card style={{ background: "linear-gradient(135deg, #0c1e18, #0a1428)", borderColor: C.accentGlow }}>
        <div style={{ color: C.muted, fontSize: 10, letterSpacing: 2, textTransform: "uppercase" }}>Patrimônio Total</div>
        <div style={{ color: C.accent, fontSize: 32, fontWeight: 900, fontFamily: "'DM Mono',monospace", margin: "6px 0 10px" }}>{fmt(total)}</div>
        <div style={{ display: "flex", gap: 20 }}>
          <div><div style={{ color: C.muted, fontSize: 9 }}>EM CONTAS</div><div style={{ color: C.blue, fontWeight: 700, fontSize: 13 }}>{fmt(saldoContas)}</div></div>
          <div><div style={{ color: C.muted, fontSize: 9 }}>INVESTIDO</div><div style={{ color: C.purple, fontWeight: 700, fontSize: 13 }}>{fmt(valorAtivos)}</div></div>
        </div>
      </Card>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <Card><div style={{ color: C.muted, fontSize: 9 }}>RECEITAS</div><div style={{ color: C.accent, fontSize: 17, fontWeight: 800, fontFamily: "'DM Mono',monospace", marginTop: 4 }}>{fmt(recMes)}</div></Card>
        <Card><div style={{ color: C.muted, fontSize: 9 }}>DESPESAS</div><div style={{ color: C.red,    fontSize: 17, fontWeight: 800, fontFamily: "'DM Mono',monospace", marginTop: 4 }}>{fmt(despMes)}</div></Card>
        <Card><div style={{ color: C.muted, fontSize: 9 }}>RESULTADO</div><div style={{ color: resultado >= 0 ? C.accent : C.red, fontSize: 17, fontWeight: 800, fontFamily: "'DM Mono',monospace", marginTop: 4 }}>{fmt(resultado)}</div></Card>
        <Card><div style={{ color: C.muted, fontSize: 9 }}>POUPANÇA</div><div style={{ color: C.yellow, fontSize: 17, fontWeight: 800, fontFamily: "'DM Mono',monospace", marginTop: 4 }}>{poupanca}%</div></Card>
      </div>
      {patByMonth.length >= 2 && (
        <Card>
          <div style={{ color: C.text, fontWeight: 700, marginBottom: 12, fontSize: 13 }}>Receitas vs Despesas</div>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={patByMonth}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
              <XAxis dataKey="mes" tick={{ fill: C.muted, fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: C.muted, fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
              <Tooltip content={<MiniTooltip />} />
              <Bar dataKey="rec"  fill={C.accent} radius={[4,4,0,0]} name="Receitas" />
              <Bar dataKey="desp" fill={C.red}    radius={[4,4,0,0]} name="Despesas" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}
      {gastosCat.length > 0 && (
        <Card>
          <div style={{ color: C.text, fontWeight: 700, marginBottom: 12, fontSize: 13 }}>Gastos por Categoria</div>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <ResponsiveContainer width={110} height={110}>
              <PieChart>
                <Pie data={gastosCat} dataKey="valor" cx="50%" cy="50%" innerRadius={30} outerRadius={52}>
                  {gastosCat.map((c,i) => <Cell key={i} fill={c.cor} />)}
                </Pie>
                <Tooltip formatter={v => fmt(v)} contentStyle={{ background: C.card, border: `1px solid ${C.border}`, fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
              {gastosCat.map((c,i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ width: 7, height: 7, borderRadius: "50%", background: c.cor, flexShrink: 0 }} />
                    <span style={{ color: C.muted, fontSize: 11 }}>{c.nome}</span>
                  </div>
                  <span style={{ color: C.text, fontSize: 11, fontWeight: 700 }}>{fmt(c.valor)}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}
      <Card>
        <div style={{ color: C.text, fontWeight: 700, marginBottom: 10, fontSize: 13 }}>Últimas Transações</div>
        {ultimas.length === 0
          ? <Empty icon="📋" msg="Nenhuma transação" sub="Vá em Transações para adicionar" />
          : <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {ultimas.map(t => (
                <div key={t.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 12px", background: C.surface, borderRadius: 10 }}>
                  <div>
                    <div style={{ color: C.text, fontSize: 13, fontWeight: 600 }}>{t.descricao}</div>
                    <div style={{ color: C.muted, fontSize: 10, marginTop: 2 }}>{t.cat}{t.subcat ? ` › ${t.subcat}` : ""} · {t.data}</div>
                  </div>
                  <span style={{ color: t.tipo === "rec" ? C.accent : C.red, fontWeight: 800, fontFamily: "'DM Mono',monospace", fontSize: 13 }}>
                    {t.tipo === "rec" ? "+" : "−"}{fmt(t.valor)}
                  </span>
                </div>
              ))}
            </div>
        }
      </Card>
      {proximas.length > 0 && (
        <Card>
          <div style={{ color: C.text, fontWeight: 700, marginBottom: 10, fontSize: 13 }}>Próximas Contas</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {proximas.map(t => (
              <div key={t.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 12px", background: C.surface, borderRadius: 10 }}>
                <div>
                  <div style={{ color: C.text, fontSize: 13, fontWeight: 600 }}>{t.descricao}</div>
                  <div style={{ color: C.muted, fontSize: 10 }}>Vence {t.data}</div>
                </div>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <span style={{ color: C.red, fontWeight: 700, fontFamily: "'DM Mono',monospace", fontSize: 13 }}>{fmt(t.valor)}</span>
                  <Badge color={C.yellow}>pendente</Badge>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

// ─── TRANSAÇÕES ───────────────────────────────────────────────────────────────
function Transacoes({ transacoes, setTransacoes, contas, cats, loading }) {
  const [modal, setModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filtro, setFiltro] = useState("todos");
  const [form, setForm] = useState({ tipo: "desp", descricao: "", valor: "", data: hoje(), cat: "", subcat: "", conta: "", status: "pago", recorrencia: "nenhuma" });
  const f = k => v => setForm(p => ({ ...p, [k]: v }));

  const catAtual = cats[form.tipo === "rec" ? "rec" : "desp"].find(c => c.nome === form.cat);
  const subsDisponiveis = catAtual?.subs || [];

  const salvar = async () => {
    if (!form.descricao || !form.valor || !form.data) return;
    setSaving(true);
    const nova = { ...form, id: uid(), valor: Number(form.valor) };
    await db.insert("transacoes", nova);
    setTransacoes(p => [nova, ...p]);
    setModal(false);
    setForm({ tipo: "desp", descricao: "", valor: "", data: hoje(), cat: "", subcat: "", conta: "", status: "pago", recorrencia: "nenhuma" });
    setSaving(false);
  };

  const excluir = async id => {
    await db.remove("transacoes", id);
    setTransacoes(p => p.filter(t => t.id !== id));
  };

  const lista = [...(filtro === "todos" ? transacoes : transacoes.filter(t => t.tipo === filtro))].sort((a,b) => new Date(b.data) - new Date(a.data));
  const catOptions = cats[form.tipo === "rec" ? "rec" : "desp"].map(c => c.nome);
  const contaOptions = contas.map(c => c.nome);

  if (loading) return <Spinner />;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        {["todos","rec","desp"].map(f2 => (
          <button key={f2} onClick={() => setFiltro(f2)} style={{
            padding: "7px 14px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700,
            background: filtro === f2 ? C.accent : C.surface, color: filtro === f2 ? C.bg : C.muted, fontFamily: "inherit"
          }}>{f2 === "todos" ? "Todos" : f2 === "rec" ? "Receitas" : "Despesas"}</button>
        ))}
        <Btn onClick={() => setModal(true)} small style={{ marginLeft: "auto" }}>+ Novo</Btn>
      </div>
      {lista.length === 0
        ? <Card><Empty icon="💳" msg="Nenhuma transação" sub="Toque em '+ Novo' para adicionar" /></Card>
        : lista.map(t => (
          <Card key={t.id} style={{ padding: "12px 14px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div style={{ flex: 1, minWidth: 0, marginRight: 10 }}>
                <div style={{ color: C.text, fontSize: 14, fontWeight: 600, marginBottom: 5 }}>{t.descricao}</div>
                <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                  {t.cat && <Badge color={t.tipo === "rec" ? C.accent : C.blue}>{t.cat}</Badge>}
                  {t.subcat && <Badge color={C.purple}>{t.subcat}</Badge>}
                  {t.conta && <Badge color={C.muted}>{t.conta}</Badge>}
                  <Badge color={t.status === "pago" ? C.accent : C.yellow}>{t.status}</Badge>
                  <span style={{ color: C.muted, fontSize: 11, alignSelf: "center" }}>{t.data}</span>
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 5 }}>
                <span style={{ color: t.tipo === "rec" ? C.accent : C.red, fontWeight: 800, fontFamily: "'DM Mono',monospace", fontSize: 15 }}>
                  {t.tipo === "rec" ? "+" : "−"}{fmt(t.valor)}
                </span>
                <button onClick={() => excluir(t.id)} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 14 }}>🗑</button>
              </div>
            </div>
          </Card>
        ))
      }
      {modal && (
        <Modal title="Nova Transação" onClose={() => setModal(false)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
            <div style={{ display: "flex", gap: 8 }}>
              {[["rec","Receita",C.accent],["desp","Despesa",C.red],["transf","Transf.",C.blue]].map(([tp,label,cor]) => (
                <button key={tp} onClick={() => f("tipo")(tp)} style={{
                  flex: 1, padding: "9px 0", borderRadius: 9, border: "none", cursor: "pointer", fontWeight: 700, fontSize: 12,
                  background: form.tipo === tp ? cor : C.surface, color: form.tipo === tp ? C.bg : C.muted, fontFamily: "inherit"
                }}>{label}</button>
              ))}
            </div>
            <InputField label="Descrição" value={form.descricao} onChange={f("descricao")} placeholder="Ex: Supermercado" />
            <InputField label="Valor (R$)" value={form.valor} onChange={f("valor")} type="number" placeholder="0,00" />
            <InputField label="Data" value={form.data} onChange={f("data")} type="date" />
            <InputField label="Categoria" value={form.cat} onChange={v => { f("cat")(v); f("subcat")(""); }} options={catOptions.length ? catOptions : ["(configure em ⚙️)"]} />
            {subsDisponiveis.length > 0 && <InputField label="Subcategoria" value={form.subcat} onChange={f("subcat")} options={subsDisponiveis} />}
            {contaOptions.length > 0 && <InputField label="Conta / Cartão" value={form.conta} onChange={f("conta")} options={contaOptions} />}
            <InputField label="Status" value={form.status} onChange={f("status")} options={["pago","pendente"]} />
            <InputField label="Recorrência" value={form.recorrencia} onChange={f("recorrencia")} options={["nenhuma","mensal","semanal","anual"]} />
            <Btn onClick={salvar} full>{saving ? "Salvando..." : "Salvar"}</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── INVESTIMENTOS ────────────────────────────────────────────────────────────
function Investimentos({ ativos, setAtivos, loading }) {
  const [modal, setModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ ticker: "", qtd: "", pmedio: "", atual: "", setor: "" });
  const f = k => v => setForm(p => ({ ...p, [k]: v }));

  const salvar = async () => {
    if (!form.ticker || !form.qtd || !form.pmedio) return;
    setSaving(true);
    const novo = { ...form, id: uid(), qtd: Number(form.qtd), pmedio: Number(form.pmedio), atual: Number(form.atual || form.pmedio) };
    await db.insert("ativos", novo);
    setAtivos(p => [...p, novo]);
    setModal(false);
    setForm({ ticker: "", qtd: "", pmedio: "", atual: "", setor: "" });
    setSaving(false);
  };

  const excluir = async id => { await db.remove("ativos", id); setAtivos(p => p.filter(a => a.id !== id)); };

  const carteira = ativos.map((a,i) => ({
    ...a,
    vinvest: Number(a.qtd) * Number(a.pmedio),
    vatual:  Number(a.qtd) * Number(a.atual||a.pmedio),
    lucro:   (Number(a.atual||a.pmedio) - Number(a.pmedio)) * Number(a.qtd),
    pct:     ((Number(a.atual||a.pmedio) - Number(a.pmedio)) / Number(a.pmedio)) * 100,
    cor: PALETTE[i % PALETTE.length],
  }));
  const totalInvest = carteira.reduce((s,a) => s + a.vinvest, 0);
  const totalAtual  = carteira.reduce((s,a) => s + a.vatual, 0);
  const lucroTotal  = totalAtual - totalInvest;

  if (loading) return <Spinner />;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <Card><div style={{ color: C.muted, fontSize: 9 }}>INVESTIDO</div><div style={{ color: C.blue, fontSize: 17, fontWeight: 800, fontFamily: "'DM Mono',monospace", marginTop: 4 }}>{fmt(totalInvest)}</div></Card>
        <Card><div style={{ color: C.muted, fontSize: 9 }}>ATUAL</div><div style={{ color: C.text, fontSize: 17, fontWeight: 800, fontFamily: "'DM Mono',monospace", marginTop: 4 }}>{fmt(totalAtual)}</div></Card>
        <Card style={{ gridColumn: "span 2" }}>
          <div style={{ color: C.muted, fontSize: 9 }}>RESULTADO</div>
          <div style={{ color: lucroTotal >= 0 ? C.accent : C.red, fontSize: 22, fontWeight: 900, fontFamily: "'DM Mono',monospace", marginTop: 4 }}>
            {fmt(lucroTotal)}{totalInvest > 0 && <span style={{ fontSize: 13, marginLeft: 8 }}>{fmtPct((lucroTotal/totalInvest)*100)}</span>}
          </div>
        </Card>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end" }}><Btn small onClick={() => setModal(true)}>+ Ativo</Btn></div>
      {carteira.length === 0
        ? <Card><Empty icon="📈" msg="Carteira vazia" sub="Adicione ações para acompanhar" /></Card>
        : <>
            {carteira.length > 1 && (
              <Card>
                <div style={{ color: C.text, fontWeight: 700, marginBottom: 12, fontSize: 13 }}>Alocação</div>
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <ResponsiveContainer width={110} height={110}>
                    <PieChart>
                      <Pie data={carteira} dataKey="vatual" cx="50%" cy="50%" innerRadius={28} outerRadius={50}>
                        {carteira.map((a,i) => <Cell key={i} fill={a.cor} />)}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 5 }}>
                    {carteira.map((a,i) => (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <div style={{ width: 7, height: 7, borderRadius: "50%", background: a.cor }} />
                          <span style={{ color: C.muted, fontSize: 12 }}>{a.ticker}</span>
                        </div>
                        <span style={{ color: C.text, fontSize: 12, fontWeight: 700 }}>{totalAtual > 0 ? ((a.vatual/totalAtual)*100).toFixed(1) : 0}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
            )}
            {carteira.map(a => (
              <Card key={a.id}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ display: "flex", gap: 7, marginBottom: 8 }}>
                      <Badge color={C.yellow}>{a.ticker}</Badge>
                      {a.setor && <span style={{ color: C.muted, fontSize: 11, alignSelf: "center" }}>{a.setor}</span>}
                    </div>
                    <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
                      <div><div style={{ color: C.muted, fontSize: 9 }}>QTD</div><div style={{ color: C.text, fontSize: 13, fontWeight: 700 }}>{a.qtd}</div></div>
                      <div><div style={{ color: C.muted, fontSize: 9 }}>P.MÉDIO</div><div style={{ color: C.text, fontSize: 13, fontWeight: 700 }}>R${Number(a.pmedio).toFixed(2)}</div></div>
                      <div><div style={{ color: C.muted, fontSize: 9 }}>P.ATUAL</div><div style={{ color: C.text, fontSize: 13, fontWeight: 700 }}>R${Number(a.atual||a.pmedio).toFixed(2)}</div></div>
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 5 }}>
                    <div style={{ color: a.lucro >= 0 ? C.accent : C.red, fontWeight: 900, fontFamily: "'DM Mono',monospace", fontSize: 15 }}>{fmt(a.lucro)}</div>
                    <Badge color={a.pct >= 0 ? C.accent : C.red}>{fmtPct(a.pct)}</Badge>
                    <button onClick={() => excluir(a.id)} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 13 }}>🗑</button>
                  </div>
                </div>
              </Card>
            ))}
          </>
      }
      {modal && (
        <Modal title="Novo Ativo" onClose={() => setModal(false)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
            <InputField label="Ticker" value={form.ticker} onChange={f("ticker")} placeholder="Ex: PETR4" />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <InputField label="Quantidade" value={form.qtd}    onChange={f("qtd")}    type="number" placeholder="0" />
              <InputField label="Preço Médio" value={form.pmedio} onChange={f("pmedio")} type="number" placeholder="0,00" />
            </div>
            <InputField label="Preço Atual (opcional)" value={form.atual}  onChange={f("atual")}  type="number" placeholder="Vazio = igual ao médio" />
            <InputField label="Setor"                  value={form.setor} onChange={f("setor")} placeholder="Ex: Energia" />
            <Btn onClick={salvar} full>{saving ? "Salvando..." : "Salvar"}</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── SWING TRADE ──────────────────────────────────────────────────────────────
function SwingTrade({ swings, setSwings, loading }) {
  const [modal, setModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ ativo: "", entrada: hoje(), saida: "", pe: "", ps: "", qtd: "", estrategia: "", obs: "" });
  const f = k => v => setForm(p => ({ ...p, [k]: v }));

  const salvar = async () => {
    if (!form.ativo || !form.pe || !form.qtd) return;
    setSaving(true);
    const nova = { ...form, id: uid(), pe: Number(form.pe), ps: form.ps ? Number(form.ps) : null, qtd: Number(form.qtd) };
    await db.insert("swings", nova);
    setSwings(p => [nova, ...p]);
    setModal(false);
    setForm({ ativo: "", entrada: hoje(), saida: "", pe: "", ps: "", qtd: "", estrategia: "", obs: "" });
    setSaving(false);
  };

  const excluir = async id => { await db.remove("swings", id); setSwings(p => p.filter(s => s.id !== id)); };

  const ops = swings.filter(o => o.ps).map(o => ({
    ...o, resultado: (Number(o.ps)-Number(o.pe))*Number(o.qtd),
    pct: ((Number(o.ps)-Number(o.pe))/Number(o.pe))*100,
  }));
  const wins    = ops.filter(o => o.resultado > 0);
  const losses  = ops.filter(o => o.resultado <= 0);
  const winRate = ops.length > 0 ? (wins.length/ops.length)*100 : 0;
  const lucroMedio = wins.length   > 0 ? wins.reduce((s,o)   => s+o.resultado,0)/wins.length   : 0;
  const prejMedio  = losses.length > 0 ? Math.abs(losses.reduce((s,o) => s+o.resultado,0)/losses.length) : 0;
  const EV      = (winRate/100*lucroMedio) - ((1-winRate/100)*prejMedio);
  const grossWin  = wins.reduce((s,o) => s+o.resultado,0);
  const grossLoss = Math.abs(losses.reduce((s,o) => s+o.resultado,0));
  const pf = grossLoss > 0 ? grossWin/grossLoss : grossWin > 0 ? 99 : 0;
  let cap = 10000;
  const curve = ops.map((o,i) => { cap += o.resultado; return { op:`#${i+1}`, capital:cap }; });

  if (loading) return <Spinner />;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {ops.length > 0 && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Card><div style={{ color: C.muted, fontSize: 9 }}>WIN RATE</div><div style={{ color: winRate >= 50 ? C.accent : C.red, fontSize: 24, fontWeight: 900, marginTop: 4 }}>{winRate.toFixed(0)}%</div></Card>
            <Card><div style={{ color: C.muted, fontSize: 9 }}>PROFIT FACTOR</div><div style={{ color: pf >= 1 ? C.accent : C.red, fontSize: 24, fontWeight: 900, marginTop: 4 }}>{pf >= 99 ? "∞" : pf.toFixed(2)}</div></Card>
            <Card><div style={{ color: C.muted, fontSize: 9 }}>LUCRO MÉDIO</div><div style={{ color: C.accent, fontSize: 14, fontWeight: 800, fontFamily: "'DM Mono',monospace", marginTop: 4 }}>{fmt(lucroMedio)}</div></Card>
            <Card><div style={{ color: C.muted, fontSize: 9 }}>PREJ. MÉDIO</div><div style={{ color: C.red, fontSize: 14, fontWeight: 800, fontFamily: "'DM Mono',monospace", marginTop: 4 }}>{fmt(prejMedio)}</div></Card>
            <Card style={{ gridColumn: "span 2" }}><div style={{ color: C.muted, fontSize: 9 }}>EXPECTATIVA MATEMÁTICA (EV)</div><div style={{ color: EV >= 0 ? C.accent : C.red, fontSize: 22, fontWeight: 900, fontFamily: "'DM Mono',monospace", marginTop: 4 }}>{fmt(EV)}</div></Card>
          </div>
          {curve.length > 1 && (
            <Card>
              <div style={{ color: C.text, fontWeight: 700, marginBottom: 12, fontSize: 13 }}>Curva de Capital</div>
              <ResponsiveContainer width="100%" height={150}>
                <AreaChart data={curve}>
                  <defs><linearGradient id="gradC" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={C.blue} stopOpacity={0.3}/><stop offset="95%" stopColor={C.blue} stopOpacity={0}/></linearGradient></defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                  <XAxis dataKey="op" tick={{ fill: C.muted, fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: C.muted, fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                  <Tooltip content={<MiniTooltip />} />
                  <Area type="monotone" dataKey="capital" stroke={C.blue} strokeWidth={2} fill="url(#gradC)" dot={{ fill: C.blue, r: 3 }} />
                </AreaChart>
              </ResponsiveContainer>
            </Card>
          )}
        </>
      )}
      <div style={{ display: "flex", justifyContent: "flex-end" }}><Btn small onClick={() => setModal(true)}>+ Operação</Btn></div>
      {swings.length === 0
        ? <Card><Empty icon="📊" msg="Nenhuma operação" sub="Registre suas operações de swing trade" /></Card>
        : swings.map(o => {
            const resultado = o.ps ? (Number(o.ps)-Number(o.pe))*Number(o.qtd) : null;
            const pct       = o.ps ? ((Number(o.ps)-Number(o.pe))/Number(o.pe))*100 : null;
            return (
              <Card key={o.id}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", gap: 6, marginBottom: 7, flexWrap: "wrap" }}>
                      <Badge color={C.yellow}>{o.ativo}</Badge>
                      {o.estrategia && <Badge color={C.purple}>{o.estrategia}</Badge>}
                      {!o.ps && <Badge color={C.orange}>Aberta</Badge>}
                    </div>
                    <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                      <div><span style={{ color: C.muted, fontSize: 10 }}>Entrada: </span><span style={{ color: C.text, fontSize: 12 }}>{o.entrada} · R${Number(o.pe).toFixed(2)}</span></div>
                      {o.saida && <div><span style={{ color: C.muted, fontSize: 10 }}>Saída: </span><span style={{ color: C.text, fontSize: 12 }}>{o.saida} · R${Number(o.ps).toFixed(2)}</span></div>}
                      <div><span style={{ color: C.muted, fontSize: 10 }}>Qtd: </span><span style={{ color: C.text, fontSize: 12 }}>{o.qtd}</span></div>
                    </div>
                    {o.obs && <div style={{ color: C.muted, fontSize: 11, marginTop: 5 }}>{o.obs}</div>}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 5 }}>
                    {resultado !== null
                      ? <><div style={{ color: resultado >= 0 ? C.accent : C.red, fontWeight: 900, fontFamily: "'DM Mono',monospace", fontSize: 15 }}>{fmt(resultado)}</div>
                          <Badge color={pct >= 0 ? C.accent : C.red}>{fmtPct(pct)}</Badge></>
                      : <Badge color={C.orange}>Em aberto</Badge>
                    }
                    <button onClick={() => excluir(o.id)} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 13 }}>🗑</button>
                  </div>
                </div>
              </Card>
            );
          })
      }
      {modal && (
        <Modal title="Nova Operação" onClose={() => setModal(false)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
            <InputField label="Ticker" value={form.ativo} onChange={f("ativo")} placeholder="Ex: PETR4" />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <InputField label="Data Entrada" value={form.entrada} onChange={f("entrada")} type="date" />
              <InputField label="Data Saída"   value={form.saida}   onChange={f("saida")}   type="date" />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              <InputField label="P. Entrada" value={form.pe}  onChange={f("pe")}  type="number" placeholder="0,00" />
              <InputField label="P. Saída"   value={form.ps}  onChange={f("ps")}  type="number" placeholder="0,00" />
              <InputField label="Quantidade" value={form.qtd} onChange={f("qtd")} type="number" placeholder="0" />
            </div>
            <InputField label="Estratégia"  value={form.estrategia} onChange={f("estrategia")} options={ESTRATEGIAS} />
            <InputField label="Observações" value={form.obs}        onChange={f("obs")}        placeholder="Notas da operação..." />
            <Btn onClick={salvar} full>{saving ? "Salvando..." : "Salvar"}</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── PATRIMÔNIO ───────────────────────────────────────────────────────────────
function Patrimonio({ transacoes, contas, ativos, loading }) {
  const saldoContas = contas.filter(c => c.tipo !== "Cartão Crédito").reduce((s,c) => s+Number(c.saldo),0);
  const valorAtivos = ativos.reduce((s,a) => s+Number(a.atual||a.pmedio)*Number(a.qtd),0);
  const total = saldoContas + valorAtivos;
  const byMonth = useMemo(() => {
    const map = {};
    transacoes.forEach(t => {
      const d = new Date(t.data);
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
      if (!map[key]) map[key] = { rec:0, desp:0 };
      if (t.tipo === "rec")  map[key].rec  += Number(t.valor);
      if (t.tipo === "desp") map[key].desp += Number(t.valor);
    });
    let acc = 0;
    return Object.entries(map).sort().map(([k,v]) => { acc += v.rec-v.desp; return { mes: k.slice(5)+"/"+k.slice(2,4), resultado: v.rec-v.desp, acumulado: acc }; });
  }, [transacoes]);

  if (loading) return <Spinner />;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <Card style={{ background: "linear-gradient(135deg, #0c1e18, #0a1428)", borderColor: C.accentGlow }}>
        <div style={{ color: C.muted, fontSize: 10, letterSpacing: 2, textTransform: "uppercase" }}>Patrimônio Total</div>
        <div style={{ color: C.accent, fontSize: 32, fontWeight: 900, fontFamily: "'DM Mono',monospace", margin: "6px 0 10px" }}>{fmt(total)}</div>
        <div style={{ display: "flex", gap: 20 }}>
          <div><div style={{ color: C.muted, fontSize: 9 }}>CONTAS</div><div style={{ color: C.blue, fontWeight: 700 }}>{fmt(saldoContas)}</div></div>
          <div><div style={{ color: C.muted, fontSize: 9 }}>INVESTIMENTOS</div><div style={{ color: C.purple, fontWeight: 700 }}>{fmt(valorAtivos)}</div></div>
        </div>
      </Card>
      {byMonth.length >= 2
        ? <>
            <Card>
              <div style={{ color: C.text, fontWeight: 700, marginBottom: 12, fontSize: 13 }}>Resultado Acumulado</div>
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={byMonth}>
                  <defs><linearGradient id="gradP" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={C.accent} stopOpacity={0.3}/><stop offset="95%" stopColor={C.accent} stopOpacity={0}/></linearGradient></defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                  <XAxis dataKey="mes" tick={{ fill: C.muted, fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: C.muted, fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                  <Tooltip content={<MiniTooltip />} />
                  <Area type="monotone" dataKey="acumulado" stroke={C.accent} strokeWidth={2} fill="url(#gradP)" name="Acumulado" />
                </AreaChart>
              </ResponsiveContainer>
            </Card>
            <Card>
              <div style={{ color: C.text, fontWeight: 700, marginBottom: 12, fontSize: 13 }}>Resultado por Mês</div>
              <ResponsiveContainer width="100%" height={150}>
                <BarChart data={byMonth}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                  <XAxis dataKey="mes" tick={{ fill: C.muted, fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: C.muted, fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(1)}k`} />
                  <Tooltip content={<MiniTooltip />} />
                  <Bar dataKey="resultado" radius={[4,4,0,0]} name="Resultado">
                    {byMonth.map((d,i) => <Cell key={i} fill={d.resultado >= 0 ? C.accent : C.red} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </>
        : <Card><Empty icon="📈" msg="Dados insuficientes" sub="Adicione transações para ver a evolução" /></Card>
      }
    </div>
  );
}

// ─── RELATÓRIOS ───────────────────────────────────────────────────────────────
function Relatorios({ transacoes, ativos, swings, loading }) {
  const now = new Date();
  const mesN = now.getMonth()+1, anoN = now.getFullYear();
  const doMes = transacoes.filter(t => { const d=new Date(t.data); return d.getMonth()+1===mesN && d.getFullYear()===anoN; });
  const doAno = transacoes.filter(t => new Date(t.data).getFullYear()===anoN);
  const recMes  = doMes.filter(t => t.tipo==="rec").reduce((s,t)  => s+Number(t.valor),0);
  const despMes = doMes.filter(t => t.tipo==="desp").reduce((s,t) => s+Number(t.valor),0);
  const recAno  = doAno.filter(t => t.tipo==="rec").reduce((s,t)  => s+Number(t.valor),0);
  const despAno = doAno.filter(t => t.tipo==="desp").reduce((s,t) => s+Number(t.valor),0);
  const catDesp = {};
  doMes.filter(t => t.tipo==="desp").forEach(t => { catDesp[t.cat||"Outros"]=(catDesp[t.cat||"Outros"]||0)+Number(t.valor); });
  const topCat = Object.entries(catDesp).sort((a,b) => b[1]-a[1]);
  const lucroSwing   = swings.filter(o=>o.ps).reduce((s,o) => s+(Number(o.ps)-Number(o.pe))*Number(o.qtd),0);
  const totalAtual   = ativos.reduce((s,a) => s+Number(a.atual||a.pmedio)*Number(a.qtd),0);
  const totalInvest  = ativos.reduce((s,a) => s+Number(a.pmedio)*Number(a.qtd),0);
  const Row = ({ label, val, cor = C.text }) => (
    <div style={{ display:"flex", justifyContent:"space-between", padding:"10px 0", borderBottom:`1px solid ${C.border}` }}>
      <span style={{ color: C.muted, fontSize: 13 }}>{label}</span>
      <span style={{ color: cor, fontWeight: 700, fontFamily: "'DM Mono',monospace" }}>{val}</span>
    </div>
  );
  if (loading) return <Spinner />;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <Card>
        <div style={{ color: C.text, fontWeight: 700, marginBottom: 12, fontSize: 13 }}>📅 Mês Atual</div>
        <Row label="Receitas"        val={fmt(recMes)}  cor={C.accent} />
        <Row label="Despesas"        val={fmt(despMes)} cor={C.red} />
        <Row label="Resultado"       val={fmt(recMes-despMes)} cor={recMes-despMes>=0?C.accent:C.red} />
        <Row label="Taxa de Poupança" val={recMes>0?`${(((recMes-despMes)/recMes)*100).toFixed(1)}%`:"—"} cor={C.yellow} />
        <Row label="Transações"      val={String(doMes.length)} />
      </Card>
      <Card>
        <div style={{ color: C.text, fontWeight: 700, marginBottom: 12, fontSize: 13 }}>📆 Ano Atual</div>
        <Row label="Receitas"   val={fmt(recAno)}           cor={C.accent} />
        <Row label="Despesas"   val={fmt(despAno)}          cor={C.red} />
        <Row label="Resultado"  val={fmt(recAno-despAno)}   cor={recAno-despAno>=0?C.accent:C.red} />
        <Row label="Transações" val={String(doAno.length)} />
      </Card>
      <Card>
        <div style={{ color: C.text, fontWeight: 700, marginBottom: 12, fontSize: 13 }}>📊 Investimentos</div>
        <Row label="Total Investido"    val={fmt(totalInvest)}            cor={C.blue} />
        <Row label="Valor Atual"        val={fmt(totalAtual)} />
        <Row label="Resultado Carteira" val={fmt(totalAtual-totalInvest)} cor={totalAtual-totalInvest>=0?C.accent:C.red} />
        <Row label="Resultado Swing"    val={fmt(lucroSwing)}             cor={lucroSwing>=0?C.accent:C.red} />
        <Row label="Operações"          val={String(swings.length)} />
      </Card>
      {topCat.length > 0 && (
        <Card>
          <div style={{ color: C.text, fontWeight: 700, marginBottom: 12, fontSize: 13 }}>🏷 Gastos por Categoria</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {topCat.map(([cat, val], i) => {
              const pct = despMes > 0 ? (val/despMes)*100 : 0;
              return (
                <div key={i}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ color: C.text, fontSize: 12 }}>{cat}</span>
                    <span style={{ color: C.muted, fontSize: 12 }}>{fmt(val)} · {pct.toFixed(1)}%</span>
                  </div>
                  <div style={{ background: C.border, borderRadius: 4, height: 5 }}>
                    <div style={{ background: PALETTE[i%PALETTE.length], height: "100%", width:`${pct}%`, borderRadius: 4 }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}

// ─── CONFIGURAÇÕES ────────────────────────────────────────────────────────────
function Configuracoes({ cats, setCats, contas, setContas, loading }) {
  const [tab, setTab] = useState("cat-desp");
  const [modalCat, setModalCat]     = useState(null);
  const [modalSub, setModalSub]     = useState(null);
  const [modalConta, setModalConta] = useState(false);
  const [nomeCat, setNomeCat]       = useState("");
  const [nomeSub, setNomeSub]       = useState("");
  const [saving, setSaving]         = useState(false);
  const [formConta, setFormConta]   = useState({ nome:"", saldo:"", tipo:"Conta Corrente", icon:"🏦", vencimento:"", limite:"" });
  const fc = k => v => setFormConta(p => ({ ...p, [k]: v }));

  const addCat = async (tipo) => {
    if (!nomeCat.trim()) return;
    setSaving(true);
    const nova = { id: uid(), nome: nomeCat.trim(), subs: [] };
    await db.insert("cats", { ...nova, tipo, subs: JSON.stringify([]) });
    const updated = { ...cats, [tipo]: [...cats[tipo], nova] };
    setCats(updated);
    setNomeCat(""); setModalCat(null); setSaving(false);
  };

  const delCat = async (tipo, id) => {
    await db.remove("cats", id);
    setCats(p => ({ ...p, [tipo]: p[tipo].filter(c => c.id !== id) }));
  };

  const addSub = async (tipo, catId) => {
    if (!nomeSub.trim()) return;
    setSaving(true);
    const cat = cats[tipo].find(c => c.id === catId);
    const newSubs = [...cat.subs, nomeSub.trim()];
    await db.update("cats", catId, { subs: JSON.stringify(newSubs) });
    setCats(p => ({ ...p, [tipo]: p[tipo].map(c => c.id === catId ? { ...c, subs: newSubs } : c) }));
    setNomeSub(""); setModalSub(null); setSaving(false);
  };

  const delSub = async (tipo, catId, sub) => {
    const cat = cats[tipo].find(c => c.id === catId);
    const newSubs = cat.subs.filter(s => s !== sub);
    await db.update("cats", catId, { subs: JSON.stringify(newSubs) });
    setCats(p => ({ ...p, [tipo]: p[tipo].map(c => c.id === catId ? { ...c, subs: newSubs } : c) }));
  };

  const addConta = async () => {
    if (!formConta.nome) return;
    setSaving(true);
    const nova = { ...formConta, id: uid(), saldo: Number(formConta.saldo||0), cor: PALETTE[contas.length%PALETTE.length] };
    await db.insert("contas", nova);
    setContas(p => [...p, nova]);
    setFormConta({ nome:"", saldo:"", tipo:"Conta Corrente", icon:"🏦", vencimento:"", limite:"" });
    setModalConta(false); setSaving(false);
  };

  const delConta = async id => { await db.remove("contas", id); setContas(p => p.filter(c => c.id !== id)); };

  const tipo = tab === "cat-rec" ? "rec" : "desp";
  const contasFiltradas = tab === "contas" ? contas.filter(c => c.tipo !== "Cartão Crédito") : contas.filter(c => c.tipo === "Cartão Crédito");
  const TABS = [
    { id: "cat-desp", label: "Despesas", icon: "📤" },
    { id: "cat-rec",  label: "Receitas", icon: "📥" },
    { id: "contas",   label: "Contas",   icon: "🏦" },
    { id: "cartoes",  label: "Cartões",  icon: "💳" },
  ];

  if (loading) return <Spinner />;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", background: C.surface, borderRadius: 12, padding: 4, gap: 2 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            flex: 1, padding: "8px 4px", borderRadius: 9, border: "none", cursor: "pointer",
            background: tab === t.id ? C.card : "transparent",
            color: tab === t.id ? C.text : C.muted,
            fontWeight: tab === t.id ? 700 : 500, fontSize: 11, fontFamily: "inherit",
            display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
            boxShadow: tab === t.id ? `0 0 0 1px ${C.border}` : "none",
          }}>
            <span style={{ fontSize: 15 }}>{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {(tab === "cat-desp" || tab === "cat-rec") && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <SectionTitle>{tab === "cat-desp" ? "Categorias de Despesa" : "Categorias de Receita"}</SectionTitle>
            <Btn small onClick={() => setModalCat(tipo)}>+ Categoria</Btn>
          </div>
          {cats[tipo].length === 0
            ? <Card><Empty icon="🏷" msg="Nenhuma categoria" sub="Adicione uma categoria" /></Card>
            : cats[tipo].map(cat => (
              <Card key={cat.id}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: cat.subs.length > 0 ? 12 : 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: tab === "cat-desp" ? C.red : C.accent }} />
                    <span style={{ color: C.text, fontWeight: 700, fontSize: 14 }}>{cat.nome}</span>
                    <span style={{ color: C.muted, fontSize: 11 }}>{cat.subs.length} subs</span>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <Btn small outline onClick={() => setModalSub({ tipo, catId: cat.id })}>+ Sub</Btn>
                    <button onClick={() => delCat(tipo, cat.id)} style={{ background: C.red+"18", border:`1px solid ${C.red}33`, color: C.red, borderRadius: 8, padding: "5px 10px", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>✕</button>
                  </div>
                </div>
                {cat.subs.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 7, paddingTop: 8, borderTop: `1px solid ${C.border}` }}>
                    {cat.subs.map(sub => (
                      <div key={sub} style={{ display: "flex", alignItems: "center", gap: 5, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 20, padding: "4px 10px 4px 12px" }}>
                        <span style={{ color: C.text, fontSize: 12 }}>{sub}</span>
                        <button onClick={() => delSub(tipo, cat.id, sub)} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 13, padding: "0 0 0 2px", lineHeight: 1 }}>×</button>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            ))
          }
        </>
      )}

      {(tab === "contas" || tab === "cartoes") && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <SectionTitle>{tab === "contas" ? "Contas Bancárias & Corretoras" : "Cartões de Crédito"}</SectionTitle>
            <Btn small onClick={() => { if (tab === "cartoes") setFormConta(p => ({ ...p, tipo: "Cartão Crédito", icon: "💳" })); setModalConta(true); }}>+ {tab === "contas" ? "Conta" : "Cartão"}</Btn>
          </div>
          {contasFiltradas.length === 0
            ? <Card><Empty icon={tab === "contas" ? "🏦" : "💳"} msg={tab === "contas" ? "Nenhuma conta" : "Nenhum cartão"} sub={tab === "contas" ? "Adicione suas contas bancárias" : "Adicione seus cartões de crédito"} /></Card>
            : contasFiltradas.map(c => (
              <Card key={c.id} style={{ borderColor: (c.cor||C.accent)+"44" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 42, height: 42, background: (c.cor||C.accent)+"22", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>{c.icon}</div>
                    <div>
                      <div style={{ color: C.text, fontWeight: 700, fontSize: 14 }}>{c.nome}</div>
                      <div style={{ display: "flex", gap: 5, marginTop: 3, flexWrap: "wrap" }}>
                        <Badge color={c.cor||C.accent}>{c.tipo}</Badge>
                        {c.vencimento && <Badge color={C.yellow}>Vence dia {c.vencimento}</Badge>}
                        {c.limite && <Badge color={C.blue}>Limite {fmt(c.limite)}</Badge>}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                    {c.tipo !== "Cartão Crédito" && <div style={{ color: c.cor||C.accent, fontSize: 18, fontWeight: 900, fontFamily: "'DM Mono',monospace" }}>{fmt(c.saldo)}</div>}
                    <button onClick={() => delConta(c.id)} style={{ background: C.red+"18", border:`1px solid ${C.red}33`, color: C.red, borderRadius: 7, padding: "4px 10px", cursor: "pointer", fontSize: 11, fontWeight: 700 }}>Remover</button>
                  </div>
                </div>
              </Card>
            ))
          }
        </>
      )}

      {modalCat && (
        <Modal title={`Nova Categoria — ${modalCat === "rec" ? "Receita" : "Despesa"}`} onClose={() => { setModalCat(null); setNomeCat(""); }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <InputField label="Nome da categoria" value={nomeCat} onChange={setNomeCat} placeholder="Ex: Moradia" />
            <Btn onClick={() => addCat(modalCat)} full>{saving ? "Salvando..." : "Adicionar"}</Btn>
          </div>
        </Modal>
      )}

      {modalSub && (
        <Modal title={`Nova Subcategoria — ${cats[modalSub.tipo].find(c => c.id === modalSub.catId)?.nome}`} onClose={() => { setModalSub(null); setNomeSub(""); }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <InputField label="Nome da subcategoria" value={nomeSub} onChange={setNomeSub} placeholder="Ex: Aluguel" />
            <Btn onClick={() => addSub(modalSub.tipo, modalSub.catId)} full>{saving ? "Salvando..." : "Adicionar"}</Btn>
          </div>
        </Modal>
      )}

      {modalConta && (
        <Modal title={formConta.tipo === "Cartão Crédito" ? "Novo Cartão" : "Nova Conta"} onClose={() => { setModalConta(false); setFormConta({ nome:"", saldo:"", tipo:"Conta Corrente", icon:"🏦", vencimento:"", limite:"" }); }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <InputField label="Nome" value={formConta.nome} onChange={fc("nome")} placeholder={formConta.tipo === "Cartão Crédito" ? "Ex: Nubank Roxinho" : "Ex: Nubank"} />
            <InputField label="Tipo" value={formConta.tipo} onChange={fc("tipo")} options={["Conta Corrente","Poupança","Corretora","Carteira","Cartão Crédito"]} />
            <InputField label="Emoji" value={formConta.icon} onChange={fc("icon")} placeholder="🏦" />
            {formConta.tipo !== "Cartão Crédito"
              ? <InputField label="Saldo Atual (R$)" value={formConta.saldo} onChange={fc("saldo")} type="number" placeholder="0,00" />
              : <>
                  <InputField label="Dia de Vencimento" value={formConta.vencimento} onChange={fc("vencimento")} type="number" placeholder="Ex: 10" />
                  <InputField label="Limite (R$)"       value={formConta.limite}     onChange={fc("limite")}     type="number" placeholder="0,00" />
                </>
            }
            <Btn onClick={addConta} full>{saving ? "Salvando..." : "Salvar"}</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── NAV & APP ────────────────────────────────────────────────────────────────
const NAV = [
  { id: "dashboard",     label: "Início",     icon: "◈" },
  { id: "transacoes",    label: "Transações", icon: "⇄" },
  { id: "patrimonio",    label: "Patrimônio", icon: "▲" },
  { id: "investimentos", label: "Carteira",   icon: "◆" },
  { id: "swing",         label: "Swing",      icon: "⟡" },
  { id: "relatorios",    label: "Relatórios", icon: "≡" },
  { id: "config",        label: "Config.",    icon: "⚙" },
];

export default function App() {
  const [screen, setScreen]           = useState("dashboard");
  const [transacoes, setTransacoes]   = useState([]);
  const [contas, setContas]           = useState([]);
  const [ativos, setAtivos]           = useState([]);
  const [swings, setSwings]           = useState([]);
  const [cats, setCats]               = useState(DEFAULT_CATS);
  const [loading, setLoading]         = useState(true);
  const [syncing, setSyncing]         = useState(false);

  // Carrega tudo do Supabase na inicialização
  useEffect(() => {
    async function fetchAll() {
      setLoading(true);
      const [t, c, a, s, ct] = await Promise.all([
        db.get("transacoes"),
        db.get("contas"),
        db.get("ativos"),
        db.get("swings"),
        db.get("cats"),
      ]);
      setTransacoes(t || []);
      setContas(c || []);
      setAtivos(a || []);
      setSwings(s || []);
      // Reconstrói cats do banco
      if (ct && ct.length > 0) {
        const rebuilt = { rec: [], desp: [] };
        ct.forEach(row => {
          const tipo = row.tipo;
          if (tipo === "rec" || tipo === "desp") {
            rebuilt[tipo].push({ id: row.id, nome: row.nome, subs: Array.isArray(row.subs) ? row.subs : (typeof row.subs === "string" ? JSON.parse(row.subs) : []) });
          }
        });
        if (rebuilt.rec.length > 0 || rebuilt.desp.length > 0) setCats(rebuilt);
      }
      setLoading(false);
    }
    fetchAll();
  }, []);

  const cur = NAV.find(n => n.id === screen);
  const props = { transacoes, contas, ativos, swings, cats, loading };

  return (
    <div style={{ background: C.bg, minHeight: "100vh", fontFamily: "'Outfit','DM Sans',sans-serif", color: C.text, display: "flex", flexDirection: "column", maxWidth: 640, margin: "0 auto", position: "relative" }}>

      {/* Top Bar */}
      <div style={{ position: "sticky", top: 0, zIndex: 50, background: C.surface, borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", padding: "12px 18px", gap: 10 }}>
        <div style={{ width: 30, height: 30, background: `linear-gradient(135deg, ${C.accent}, ${C.blue})`, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 900, flexShrink: 0 }}>₿</div>
        <div>
          <div style={{ color: C.text, fontWeight: 800, fontSize: 15, lineHeight: 1.1 }}>FinControl</div>
          <div style={{ color: C.muted, fontSize: 10 }}>{cur?.label}</div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          {loading && <div style={{ width: 16, height: 16, border: `2px solid ${C.border}`, borderTopColor: C.accent, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />}
          <div style={{ background: C.accentDim, border: `1px solid ${C.accentGlow}`, borderRadius: 7, padding: "4px 10px", color: C.accent, fontSize: 11, fontWeight: 700 }}>{mesAtual()}</div>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, padding: "16px 14px 90px" }}>
        {screen === "dashboard"     && <Dashboard     {...props} />}
        {screen === "transacoes"    && <Transacoes    {...props} setTransacoes={setTransacoes} />}
        {screen === "patrimonio"    && <Patrimonio    {...props} />}
        {screen === "investimentos" && <Investimentos {...props} setAtivos={setAtivos} />}
        {screen === "swing"         && <SwingTrade    {...props} setSwings={setSwings} />}
        {screen === "relatorios"    && <Relatorios    {...props} />}
        {screen === "config"        && <Configuracoes {...props} setCats={setCats} setContas={setContas} />}
      </div>

      {/* Bottom Nav */}
      <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 640, background: C.surface, borderTop: `1px solid ${C.border}`, display: "flex", padding: "8px 2px 14px", zIndex: 50 }}>
        {NAV.map(n => (
          <button key={n.id} onClick={() => setScreen(n.id)} style={{
            flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
            background: "none", border: "none", cursor: "pointer", padding: "4px 1px",
            color: screen === n.id ? C.accent : C.muted, fontFamily: "inherit",
          }}>
            <div style={{ width: screen === n.id ? 28 : 0, height: 2, background: C.accent, borderRadius: 1, marginBottom: 2, transition: "width 0.2s" }} />
            <span style={{ fontSize: 15, lineHeight: 1 }}>{n.icon}</span>
            <span style={{ fontSize: 9, fontWeight: screen === n.id ? 700 : 500 }}>{n.label}</span>
          </button>
        ))}
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800;900&family=DM+Mono:wght@400;500;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        input, select { color-scheme: dark; }
        input[type=number]::-webkit-inner-spin-button { -webkit-appearance: none; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: ${C.border}; border-radius: 2px; }
        button { transition: opacity 0.15s; }
        button:active { opacity: 0.65; }
        input:focus, select:focus { border-color: ${C.accent} !important; outline: none; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
