"use client";

import { useEffect, useMemo, useState } from "react";

type Source = "hesap" | "kart";
type Kind = "gelir" | "gider";

type Tx = {
  id: string;
  date: string;
  source: Source;
  kind: Kind;
  category: string;
  description: string;
  amount: number;
};

const CATEGORIES = [
  "Maaş",
  "Ek Gelir",
  "Market",
  "Fatura",
  "Kira",
  "Ulaşım",
  "Yeme-İçme",
  "Eğlence",
  "Giyim",
  "Sağlık",
  "Eğitim",
  "Abonelik",
  "Diğer",
];

const STORAGE_KEY = "butce-takip-tx-v1";

const fmt = (n: number) =>
  new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 2,
  }).format(n);

const todayISO = () => new Date().toISOString().slice(0, 10);
const monthKey = (d: string) => d.slice(0, 7);
const monthLabel = (key: string) => {
  const [y, m] = key.split("-");
  const names = [
    "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
    "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
  ];
  return `${names[parseInt(m, 10) - 1]} ${y}`;
};

export default function Page() {
  const [txs, setTxs] = useState<Tx[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [month, setMonth] = useState<string>(todayISO().slice(0, 7));
  const [tab, setTab] = useState<"ozet" | "hesap" | "kart" | "oneriler">("ozet");

  const [fDate, setFDate] = useState(todayISO());
  const [fSource, setFSource] = useState<Source>("hesap");
  const [fKind, setFKind] = useState<Kind>("gider");
  const [fCategory, setFCategory] = useState<string>("Market");
  const [fDesc, setFDesc] = useState("");
  const [fAmount, setFAmount] = useState<string>("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setTxs(JSON.parse(raw));
    } catch {}
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (loaded) localStorage.setItem(STORAGE_KEY, JSON.stringify(txs));
  }, [txs, loaded]);

  const addTx = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(fAmount.replace(",", "."));
    if (!amt || amt <= 0) return;
    const tx: Tx = {
      id: crypto.randomUUID(),
      date: fDate,
      source: fSource,
      kind: fKind,
      category: fCategory,
      description: fDesc.trim(),
      amount: amt,
    };
    setTxs((s) => [tx, ...s]);
    setFAmount("");
    setFDesc("");
  };

  const removeTx = (id: string) => setTxs((s) => s.filter((t) => t.id !== id));

  const months = useMemo(() => {
    const set = new Set<string>();
    set.add(month);
    txs.forEach((t) => set.add(monthKey(t.date)));
    return Array.from(set).sort().reverse();
  }, [txs, month]);

  const monthTx = useMemo(
    () => txs.filter((t) => monthKey(t.date) === month),
    [txs, month],
  );

  const totals = useMemo(() => {
    const t = { gelir: 0, gider: 0, hesapGelir: 0, hesapGider: 0, kartGider: 0, kartGelir: 0 };
    monthTx.forEach((x) => {
      if (x.kind === "gelir") t.gelir += x.amount;
      else t.gider += x.amount;
      if (x.source === "hesap") {
        if (x.kind === "gelir") t.hesapGelir += x.amount;
        else t.hesapGider += x.amount;
      } else {
        if (x.kind === "gelir") t.kartGelir += x.amount;
        else t.kartGider += x.amount;
      }
    });
    return t;
  }, [monthTx]);

  const net = totals.gelir - totals.gider;
  const savingsRate = totals.gelir > 0 ? (net / totals.gelir) * 100 : 0;

  const categoryBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    monthTx
      .filter((t) => t.kind === "gider")
      .forEach((t) => {
        map[t.category] = (map[t.category] ?? 0) + t.amount;
      });
    return Object.entries(map)
      .map(([k, v]) => ({ category: k, amount: v }))
      .sort((a, b) => b.amount - a.amount);
  }, [monthTx]);

  const trend = useMemo(() => {
    const arr: { key: string; gelir: number; gider: number }[] = [];
    const [y, m] = month.split("-").map(Number);
    for (let i = 5; i >= 0; i--) {
      const d = new Date(y, m - 1 - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const list = txs.filter((t) => monthKey(t.date) === key);
      arr.push({
        key,
        gelir: list.filter((t) => t.kind === "gelir").reduce((s, t) => s + t.amount, 0),
        gider: list.filter((t) => t.kind === "gider").reduce((s, t) => s + t.amount, 0),
      });
    }
    return arr;
  }, [txs, month]);

  const suggestions = useMemo(() => {
    const tips: { title: string; detail: string; severity: "uyari" | "bilgi" | "iyi" }[] = [];
    if (totals.gelir === 0 && totals.gider === 0) {
      tips.push({
        title: "Bu ay için henüz veri yok",
        detail: "Gelir ve giderlerinizi girmeye başlayın.",
        severity: "bilgi",
      });
      return tips;
    }
    if (net < 0) {
      tips.push({
        title: "Dikkat! Bu ay açık veriyorsunuz",
        detail: `Giderleriniz gelirinizden ${fmt(Math.abs(net))} fazla. Sabit giderlerinizi gözden geçirin.`,
        severity: "uyari",
      });
    } else if (savingsRate < 10) {
      tips.push({
        title: "Tasarruf oranınız düşük",
        detail: `Aylık tasarruf oranı %${savingsRate.toFixed(1)}. Hedef en az %20 olmalı.`,
        severity: "uyari",
      });
    } else if (savingsRate >= 20) {
      tips.push({
        title: "Harika tasarruf oranı!",
        detail: `%${savingsRate.toFixed(1)} oranında tasarruf ediyorsunuz. Bu birikimi yatırıma yönlendirebilirsiniz.`,
        severity: "iyi",
      });
    }

    if (totals.gider > 0) {
      const top3 = categoryBreakdown.slice(0, 3);
      top3.forEach((c) => {
        const pct = (c.amount / totals.gider) * 100;
        if (pct > 30) {
          tips.push({
            title: `${c.category} harcamanız çok yüksek`,
            detail: `Toplam giderinizin %${pct.toFixed(0)}'ı (${fmt(c.amount)}) bu kategoriye gidiyor. Bu kalemde tasarruf önceliklendirilmeli.`,
            severity: "uyari",
          });
        }
      });

      const aboneAmount = monthTx
        .filter((t) => t.kind === "gider" && t.category === "Abonelik")
        .reduce((s, t) => s + t.amount, 0);
      if (aboneAmount > 0 && totals.gelir > 0 && aboneAmount / totals.gelir > 0.05) {
        tips.push({
          title: "Abonelikleri gözden geçirin",
          detail: `Aboneliklere ${fmt(aboneAmount)} harcıyorsunuz. Kullanmadıklarınızı iptal etmek aylık ciddi tasarruf sağlar.`,
          severity: "bilgi",
        });
      }

      const eglenceAmount = monthTx
        .filter(
          (t) =>
            t.kind === "gider" &&
            (t.category === "Eğlence" || t.category === "Yeme-İçme"),
        )
        .reduce((s, t) => s + t.amount, 0);
      if (eglenceAmount > 0 && eglenceAmount / totals.gider > 0.25) {
        tips.push({
          title: "Eğlence/yeme-içme bütçesi yüksek",
          detail: `Bu kategorilere giderinizin %${((eglenceAmount / totals.gider) * 100).toFixed(0)}'ı gidiyor. Haftalık bir limit belirlemek faydalı olur.`,
          severity: "bilgi",
        });
      }
    }

    if (totals.kartGider > 0 && totals.hesapGelir > 0) {
      const ratio = totals.kartGider / totals.hesapGelir;
      if (ratio > 0.5) {
        tips.push({
          title: "Kredi kartı kullanımı yüksek",
          detail: `Kart harcamanız (${fmt(totals.kartGider)}) hesap gelirinizin %${(ratio * 100).toFixed(0)}'ına ulaştı. Borç sarmalına dikkat.`,
          severity: "uyari",
        });
      }
    }

    if (trend.length >= 3) {
      const last3 = trend.slice(-3);
      const giderArtiyor =
        last3[2].gider > last3[1].gider && last3[1].gider > last3[0].gider;
      if (giderArtiyor) {
        tips.push({
          title: "Giderleriniz 3 aydır artıyor",
          detail:
            "Son 3 ayda harcamalarınız sürekli yükseldi. Trendi durdurmak için bu ay bir kategoriye limit koyun.",
          severity: "uyari",
        });
      }
    }

    return tips;
  }, [totals, net, savingsRate, categoryBreakdown, monthTx, trend]);

  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(txs, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `butce-${todayISO()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const clearAll = () => {
    if (confirm("Tüm veriler silinsin mi?")) setTxs([]);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="bg-gradient-to-r from-indigo-600 to-violet-600 text-white">
        <div className="max-w-6xl mx-auto px-4 py-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Bütçe Takip</h1>
            <p className="text-indigo-100 text-sm">
              Aylık gelir-gider, hesap ve kart ekstreleri, akıllı öneriler
            </p>
          </div>
          <select
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="bg-white/10 border border-white/30 rounded px-3 py-2 text-sm"
          >
            {months.map((m) => (
              <option key={m} value={m} className="text-slate-900">
                {monthLabel(m)}
              </option>
            ))}
          </select>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card title="Toplam Gelir" value={fmt(totals.gelir)} tone="green" />
          <Card title="Toplam Gider" value={fmt(totals.gider)} tone="red" />
          <Card title="Net" value={fmt(net)} tone={net >= 0 ? "green" : "red"} />
          <Card
            title="Tasarruf Oranı"
            value={`%${savingsRate.toFixed(1)}`}
            tone={savingsRate >= 20 ? "green" : savingsRate >= 0 ? "amber" : "red"}
          />
        </section>

        <nav className="flex gap-1 border-b border-slate-200 overflow-x-auto">
          {([
            ["ozet", "Özet & Grafikler"],
            ["hesap", "Hesap Ekstresi"],
            ["kart", "Kredi Kartı Ekstresi"],
            ["oneriler", "Tasarruf Önerileri"],
          ] as const).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 -mb-px ${
                tab === k
                  ? "border-indigo-600 text-indigo-700"
                  : "border-transparent text-slate-600 hover:text-slate-900"
              }`}
            >
              {label}
            </button>
          ))}
        </nav>

        <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <h2 className="font-semibold mb-3">Yeni İşlem Ekle</h2>
          <form onSubmit={addTx} className="grid grid-cols-2 md:grid-cols-7 gap-2">
            <input
              type="date"
              value={fDate}
              onChange={(e) => setFDate(e.target.value)}
              className="border border-slate-300 rounded px-2 py-1.5 text-sm"
              required
            />
            <select
              value={fSource}
              onChange={(e) => setFSource(e.target.value as Source)}
              className="border border-slate-300 rounded px-2 py-1.5 text-sm"
            >
              <option value="hesap">Hesap</option>
              <option value="kart">Kredi Kartı</option>
            </select>
            <select
              value={fKind}
              onChange={(e) => setFKind(e.target.value as Kind)}
              className="border border-slate-300 rounded px-2 py-1.5 text-sm"
            >
              <option value="gider">Gider</option>
              <option value="gelir">Gelir</option>
            </select>
            <select
              value={fCategory}
              onChange={(e) => setFCategory(e.target.value)}
              className="border border-slate-300 rounded px-2 py-1.5 text-sm"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <input
              type="text"
              placeholder="Açıklama"
              value={fDesc}
              onChange={(e) => setFDesc(e.target.value)}
              className="border border-slate-300 rounded px-2 py-1.5 text-sm md:col-span-2"
            />
            <input
              type="number"
              step="0.01"
              min="0"
              placeholder="Tutar (₺)"
              value={fAmount}
              onChange={(e) => setFAmount(e.target.value)}
              className="border border-slate-300 rounded px-2 py-1.5 text-sm"
              required
            />
            <button
              type="submit"
              className="bg-indigo-600 text-white rounded px-3 py-1.5 text-sm font-medium hover:bg-indigo-700 col-span-2 md:col-span-7"
            >
              Ekle
            </button>
          </form>
        </section>

        {tab === "ozet" && (
          <section className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
                <h3 className="font-semibold mb-3">Son 6 Ay Trendi</h3>
                <TrendChart data={trend} />
              </div>
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
                <h3 className="font-semibold mb-3">Kategori Dağılımı (Gider)</h3>
                {categoryBreakdown.length === 0 ? (
                  <EmptyHint text="Bu ay için gider verisi yok." />
                ) : (
                  <CategoryBars data={categoryBreakdown} total={totals.gider} />
                )}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <MiniBox label="Hesap Gelir" value={fmt(totals.hesapGelir)} tone="green" />
              <MiniBox label="Hesap Gider" value={fmt(totals.hesapGider)} tone="red" />
              <MiniBox label="Kart Gider" value={fmt(totals.kartGider)} tone="red" />
              <MiniBox
                label="Hesap Net"
                value={fmt(totals.hesapGelir - totals.hesapGider)}
                tone={totals.hesapGelir - totals.hesapGider >= 0 ? "green" : "red"}
              />
            </div>
          </section>
        )}

        {tab === "hesap" && (
          <Statement
            title="Hesap Ekstresi"
            txs={monthTx.filter((t) => t.source === "hesap")}
            onDelete={removeTx}
          />
        )}

        {tab === "kart" && (
          <Statement
            title="Kredi Kartı Ekstresi"
            txs={monthTx.filter((t) => t.source === "kart")}
            onDelete={removeTx}
          />
        )}

        {tab === "oneriler" && (
          <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
            <h3 className="font-semibold mb-3">Akıllı Tasarruf Önerileri</h3>
            <ul className="space-y-3">
              {suggestions.map((s, i) => (
                <li
                  key={i}
                  className={`p-3 rounded-lg border-l-4 ${
                    s.severity === "uyari"
                      ? "bg-red-50 border-red-500"
                      : s.severity === "iyi"
                        ? "bg-green-50 border-green-500"
                        : "bg-amber-50 border-amber-500"
                  }`}
                >
                  <div className="font-semibold text-sm">{s.title}</div>
                  <div className="text-sm text-slate-700 mt-1">{s.detail}</div>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="flex flex-wrap gap-2 pt-4">
          <button
            onClick={exportJSON}
            className="text-sm px-3 py-1.5 border border-slate-300 rounded hover:bg-white"
          >
            Verileri Dışa Aktar (JSON)
          </button>
          <button
            onClick={clearAll}
            className="text-sm px-3 py-1.5 border border-red-300 text-red-700 rounded hover:bg-red-50"
          >
            Tüm Verileri Sil
          </button>
        </section>

        <footer className="text-center text-xs text-slate-500 py-6">
          Veriler sadece tarayıcınızda (localStorage) saklanır.
        </footer>
      </main>
    </div>
  );
}

function Card({
  title,
  value,
  tone,
}: {
  title: string;
  value: string;
  tone: "green" | "red" | "amber" | "indigo";
}) {
  const tones: Record<string, string> = {
    green: "bg-green-50 text-green-700 border-green-200",
    red: "bg-red-50 text-red-700 border-red-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
    indigo: "bg-indigo-50 text-indigo-700 border-indigo-200",
  };
  return (
    <div className={`rounded-xl border p-4 ${tones[tone]}`}>
      <div className="text-xs uppercase tracking-wide font-medium opacity-80">
        {title}
      </div>
      <div className="text-xl font-bold mt-1">{value}</div>
    </div>
  );
}

function MiniBox({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "green" | "red";
}) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-3 flex items-center justify-between">
      <span className="text-sm text-slate-600">{label}</span>
      <span
        className={`font-semibold ${tone === "green" ? "text-green-700" : "text-red-700"}`}
      >
        {value}
      </span>
    </div>
  );
}

function EmptyHint({ text }: { text: string }) {
  return <div className="text-sm text-slate-500 py-8 text-center">{text}</div>;
}

function TrendChart({
  data,
}: {
  data: { key: string; gelir: number; gider: number }[];
}) {
  const max = Math.max(1, ...data.map((d) => Math.max(d.gelir, d.gider)));
  const W = 480;
  const H = 200;
  const pad = 28;
  const bw = (W - pad * 2) / data.length;
  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-56">
        <line x1={pad} y1={H - pad} x2={W - pad} y2={H - pad} stroke="#e2e8f0" />
        {data.map((d, i) => {
          const x = pad + i * bw + 6;
          const gelirH = ((H - pad * 2) * d.gelir) / max;
          const giderH = ((H - pad * 2) * d.gider) / max;
          const w = (bw - 12) / 2;
          return (
            <g key={d.key}>
              <rect
                x={x}
                y={H - pad - gelirH}
                width={w}
                height={gelirH}
                fill="#16a34a"
                rx={2}
              />
              <rect
                x={x + w + 2}
                y={H - pad - giderH}
                width={w}
                height={giderH}
                fill="#dc2626"
                rx={2}
              />
              <text
                x={x + (bw - 12) / 2}
                y={H - 8}
                fontSize="10"
                textAnchor="middle"
                fill="#64748b"
              >
                {d.key.slice(5)}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="flex gap-4 text-xs text-slate-600 mt-1">
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 bg-green-600 rounded-sm" />
          Gelir
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 bg-red-600 rounded-sm" />
          Gider
        </span>
      </div>
    </div>
  );
}

function CategoryBars({
  data,
  total,
}: {
  data: { category: string; amount: number }[];
  total: number;
}) {
  const colors = [
    "bg-indigo-500",
    "bg-rose-500",
    "bg-amber-500",
    "bg-emerald-500",
    "bg-sky-500",
    "bg-violet-500",
    "bg-pink-500",
    "bg-teal-500",
    "bg-orange-500",
    "bg-lime-500",
    "bg-cyan-500",
    "bg-fuchsia-500",
    "bg-slate-500",
  ];
  return (
    <div className="space-y-2">
      {data.map((d, i) => {
        const pct = total > 0 ? (d.amount / total) * 100 : 0;
        return (
          <div key={d.category}>
            <div className="flex justify-between text-sm mb-1">
              <span className="font-medium">{d.category}</span>
              <span className="text-slate-600">
                {fmt(d.amount)} ({pct.toFixed(1)}%)
              </span>
            </div>
            <div className="h-2 bg-slate-100 rounded">
              <div
                className={`h-2 rounded ${colors[i % colors.length]}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Statement({
  title,
  txs,
  onDelete,
}: {
  title: string;
  txs: Tx[];
  onDelete: (id: string) => void;
}) {
  const gelir = txs.filter((t) => t.kind === "gelir").reduce((s, t) => s + t.amount, 0);
  const gider = txs.filter((t) => t.kind === "gider").reduce((s, t) => s + t.amount, 0);
  const sorted = [...txs].sort((a, b) => b.date.localeCompare(a.date));
  return (
    <section className="bg-white rounded-xl shadow-sm border border-slate-200">
      <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-semibold">{title}</h3>
        <div className="flex gap-4 text-sm">
          <span className="text-green-700">Gelir: {fmt(gelir)}</span>
          <span className="text-red-700">Gider: {fmt(gider)}</span>
          <span className={gelir - gider >= 0 ? "text-green-700" : "text-red-700"}>
            Net: {fmt(gelir - gider)}
          </span>
        </div>
      </div>
      {sorted.length === 0 ? (
        <EmptyHint text="Bu ay için işlem bulunmuyor." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="text-left px-4 py-2">Tarih</th>
                <th className="text-left px-4 py-2">Kategori</th>
                <th className="text-left px-4 py-2">Açıklama</th>
                <th className="text-right px-4 py-2">Tutar</th>
                <th className="px-2 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((t) => (
                <tr key={t.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-2 whitespace-nowrap">{t.date}</td>
                  <td className="px-4 py-2">
                    <span className="inline-block px-2 py-0.5 rounded bg-slate-100 text-xs">
                      {t.category}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-slate-700">{t.description || "—"}</td>
                  <td
                    className={`px-4 py-2 text-right font-semibold whitespace-nowrap ${
                      t.kind === "gelir" ? "text-green-700" : "text-red-700"
                    }`}
                  >
                    {t.kind === "gelir" ? "+" : "−"} {fmt(t.amount)}
                  </td>
                  <td className="px-2 py-2 text-right">
                    <button
                      onClick={() => onDelete(t.id)}
                      className="text-slate-400 hover:text-red-600 text-xs"
                      title="Sil"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
