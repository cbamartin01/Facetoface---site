import { useState, useEffect, useRef, useCallback } from "react";
import { Plus, X, Search, MessageCircle, Trash2, Camera, ChevronLeft, ChevronRight, Gauge, Calendar } from "lucide-react";

const WHATSAPP_SITE_NUMBER = "5493515579543";

const SUPABASE_URL = "https://oycobcpbzkqthmcnedem.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im95Y29iY3BiemtxdGhtY25lZGVtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQyNDUzNjIsImV4cCI6MjA5OTgyMTM2Mn0.eUJkQDScxksGhI1LpNbSti7YurJsVLzvN43q1N5F9jY";

const sbHeaders = {
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  "Content-Type": "application/json",
};

const emptyForm = {
  brand: "",
  model: "",
  year: "",
  price: "",
  km: "",
  condition: "0km",
  fuel: "Nafta",
  description: "",
  phone: "",
  images: [],
};

const emptySellForm = {
  brand: "",
  model: "",
  year: "",
  km: "",
  fuel: "Nafta",
  state: "Muy bueno",
  phone: "",
  notes: "",
};

function compressImage(file, maxW = 900, quality = 0.72) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxW / img.width);
        const canvas = document.createElement("canvas");
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function fmtPrice(n) {
  const num = Number(n);
  if (!num) return "Consultar";
  return "$" + num.toLocaleString("es-AR");
}

function fmtKm(n, condition) {
  if (condition === "0km") return "0 km";
  const num = Number(n);
  return num ? num.toLocaleString("es-AR") + " km" : "-";
}

export default function FaceToFace() {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showSell, setShowSell] = useState(false);
  const [detail, setDetail] = useState(null);
  const [detailImgIdx, setDetailImgIdx] = useState(0);
  const [form, setForm] = useState(emptyForm);
  const [sellForm, setSellForm] = useState(emptySellForm);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [conditionFilter, setConditionFilter] = useState("todos");
  const [sortBy, setSortBy] = useState("recientes");
  const [toast, setToast] = useState(null);
  const fileInputRef = useRef(null);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2600);
  };

  const loadListings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/listings?select=*&order=created_at.desc`, {
        headers: sbHeaders,
      });
      if (!res.ok) throw new Error("fetch failed");
      const rows = await res.json();
      setListings(rows.map((r) => ({ ...r, createdAt: r.created_at })));
    } catch {
      setListings([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadListings();
  }, [loadListings]);

  const handleFiles = async (files) => {
    const list = Array.from(files).slice(0, 4 - form.images.length);
    if (list.length === 0) return;
    const compressed = await Promise.all(list.map((f) => compressImage(f)));
    setForm((f) => ({ ...f, images: [...f.images, ...compressed].slice(0, 4) }));
  };

  const submitListing = async () => {
    if (!form.brand.trim() || !form.model.trim() || !form.phone.trim() || form.images.length === 0) {
      showToast("Completá marca, modelo, WhatsApp y al menos 1 foto");
      return;
    }
    setSaving(true);
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const createdAt = Date.now();
    const row = {
      id,
      brand: form.brand,
      model: form.model,
      year: form.year,
      price: form.price,
      km: form.km,
      condition: form.condition,
      fuel: form.fuel,
      description: form.description,
      phone: form.phone,
      images: form.images,
      created_at: createdAt,
    };
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/listings`, {
        method: "POST",
        headers: { ...sbHeaders, Prefer: "return=representation" },
        body: JSON.stringify(row),
      });
      if (!res.ok) throw new Error("insert failed");
      setListings((l) => [{ ...row, createdAt }, ...l]);
      setForm(emptyForm);
      setShowForm(false);
      showToast("¡Publicado! Ya está visible en el catálogo");
    } catch {
      showToast("No se pudo publicar. Probá de nuevo");
    }
    setSaving(false);
  };

  const deleteListing = async (id) => {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/listings?id=eq.${id}`, {
        method: "DELETE",
        headers: sbHeaders,
      });
      if (!res.ok) throw new Error("delete failed");
      setListings((l) => l.filter((x) => x.id !== id));
      setDetail(null);
      showToast("Publicación eliminada");
    } catch {
      showToast("No se pudo eliminar");
    }
  };

  const waLink = (phone, text) => `https://wa.me/${phone.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`;

  const sendSellRequest = () => {
    if (!sellForm.brand.trim() || !sellForm.model.trim() || !sellForm.phone.trim()) {
      showToast("Completá al menos marca, modelo y tu WhatsApp");
      return;
    }
    const msg = `Hola! Quiero vender mi auto a facetoface.online\n\n` +
      `Marca y modelo: ${sellForm.brand} ${sellForm.model}\n` +
      `Año: ${sellForm.year || "-"}\n` +
      `Kilómetros: ${sellForm.km || "-"}\n` +
      `Combustible: ${sellForm.fuel}\n` +
      `Estado general: ${sellForm.state}\n` +
      (sellForm.notes ? `Comentarios: ${sellForm.notes}\n` : "") +
      `\nMi WhatsApp: ${sellForm.phone}`;
    window.open(waLink(WHATSAPP_SITE_NUMBER, msg), "_blank");
    setShowSell(false);
    setSellForm(emptySellForm);
    showToast("Te llevamos a WhatsApp para coordinar la tasación");
  };

  const filtered = listings
    .filter((c) => (conditionFilter === "todos" ? true : c.condition === conditionFilter))
    .filter((c) => {
      const q = search.trim().toLowerCase();
      if (!q) return true;
      return `${c.brand} ${c.model} ${c.description}`.toLowerCase().includes(q);
    })
    .sort((a, b) => {
      if (sortBy === "precio-asc") return (Number(a.price) || 1e15) - (Number(b.price) || 1e15);
      if (sortBy === "precio-desc") return (Number(b.price) || 0) - (Number(a.price) || 0);
      if (sortBy === "año") return (Number(b.year) || 0) - (Number(a.year) || 0);
      return b.createdAt - a.createdAt;
    });

  return (
    <div style={{ fontFamily: "'Inter',sans-serif", background: "#14161A", minHeight: "100vh", color: "#F5F3EE" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@500;600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@500;600&display=swap');
        * { box-sizing: border-box; }
        body { margin: 0; }
        ::selection { background: #FFB020; color: #14161A; }
        .ff-scroll::-webkit-scrollbar { height: 6px; width: 6px; }
        .ff-scroll::-webkit-scrollbar-thumb { background: #33373F; border-radius: 4px; }
        input:focus, select:focus, textarea:focus, button:focus-visible {
          outline: 2px solid #FFB020; outline-offset: 2px;
        }
        @media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important; } }
        .ff-card { transition: transform .18s ease, border-color .18s ease; }
        .ff-card:hover { transform: translateY(-3px); border-color: #FFB020; }
        .ff-btn-primary { transition: background .15s ease, transform .1s ease; }
        .ff-btn-primary:hover { background: #ffc250; }
        .ff-btn-primary:active { transform: scale(0.97); }
      `}</style>

      {/* Header */}
      <header style={{ borderBottom: "1px solid #24272E", position: "sticky", top: 0, zIndex: 20, background: "rgba(20,22,26,0.92)", backdropFilter: "blur(6px)" }}>
        <div style={{ maxWidth: 1180, margin: "0 auto", padding: "18px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontFamily: "'Oswald',sans-serif", fontSize: 24, fontWeight: 700, letterSpacing: 0.5, display: "flex", alignItems: "baseline", gap: 2 }}>
              face<span style={{ color: "#FFB020" }}>toface</span>
              <span style={{ fontSize: 13, color: "#8B909B", fontWeight: 500, marginLeft: 6, fontFamily: "'Inter',sans-serif" }}>.online</span>
            </div>
            <div style={{ fontSize: 12, color: "#8B909B", marginTop: 2 }}>Agencia de 0km y usados · vendemos, compramos y coordinamos todo por WhatsApp</div>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              onClick={() => setShowSell(true)}
              style={{ background: "transparent", color: "#F5F3EE", border: "1px solid #3A3E47", borderRadius: 8, padding: "11px 18px", fontWeight: 600, fontSize: 14, display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}
            >
              Vendé tu usado
            </button>
            <button
              onClick={() => setShowForm(true)}
              className="ff-btn-primary"
              style={{ background: "#FFB020", color: "#14161A", border: "none", borderRadius: 8, padding: "11px 18px", fontWeight: 600, fontSize: 14, display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}
            >
              <Plus size={18} strokeWidth={2.5} /> Publicar auto
            </button>
          </div>
        </div>
      </header>

      {/* Filters */}
      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "22px 20px 0" }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ position: "relative", flex: "1 1 240px" }}>
            <Search size={16} color="#8B909B" style={{ position: "absolute", left: 12, top: 12 }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar marca, modelo..."
              style={{ width: "100%", background: "#1E2127", border: "1px solid #2C3038", borderRadius: 8, padding: "10px 12px 10px 36px", color: "#F5F3EE", fontSize: 14 }}
            />
          </div>
          <select value={conditionFilter} onChange={(e) => setConditionFilter(e.target.value)} style={selStyle}>
            <option value="todos">Todos</option>
            <option value="0km">0km</option>
            <option value="usado">Usados</option>
          </select>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} style={selStyle}>
            <option value="recientes">Más recientes</option>
            <option value="precio-asc">Precio: menor a mayor</option>
            <option value="precio-desc">Precio: mayor a menor</option>
            <option value="año">Año más nuevo</option>
          </select>
        </div>
      </div>

      {/* Grid */}
      <main style={{ maxWidth: 1180, margin: "0 auto", padding: "22px 20px 80px" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: 60, color: "#8B909B" }}>Cargando catálogo...</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "70px 20px", color: "#8B909B", border: "1px dashed #2C3038", borderRadius: 12 }}>
            <div style={{ fontSize: 17, color: "#F5F3EE", marginBottom: 6, fontFamily: "'Oswald',sans-serif" }}>Todavía no hay autos acá</div>
            Publicá el primero y aparecerá arriba de todo.
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(270px,1fr))", gap: 18 }}>
            {filtered.map((c) => (
              <div
                key={c.id}
                className="ff-card"
                onClick={() => { setDetail(c); setDetailImgIdx(0); }}
                style={{ background: "#1E2127", border: "1px solid #2C3038", borderRadius: 12, overflow: "hidden", cursor: "pointer" }}
              >
                <div style={{ position: "relative", aspectRatio: "4/3", background: "#0F1013" }}>
                  <img src={c.images[0]} alt={`${c.brand} ${c.model}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  <span style={{
                    position: "absolute", top: 10, left: 10, fontFamily: "'JetBrains Mono',monospace", fontSize: 11, fontWeight: 600,
                    padding: "4px 9px", borderRadius: 5, background: c.condition === "0km" ? "#E4572E" : "#2E6E63", color: "#fff", letterSpacing: 0.5,
                  }}>
                    {c.condition === "0km" ? "0KM" : "USADO"}
                  </span>
                </div>
                <div style={{ padding: 14 }}>
                  <div style={{ fontFamily: "'Oswald',sans-serif", fontSize: 17, fontWeight: 600, marginBottom: 2 }}>{c.brand} {c.model}</div>
                  <div style={{ fontSize: 12, color: "#8B909B", display: "flex", gap: 12, marginBottom: 10 }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Calendar size={12} /> {c.year}</span>
                    <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Gauge size={12} /> {fmtKm(c.km, c.condition)}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 16, fontWeight: 600, color: "#FFB020" }}>{fmtPrice(c.price)}</span>
                    <a
                      href={waLink(c.phone, `Hola! Vi el ${c.brand} ${c.model} (${c.year}) publicado en facetoface.online, ¿sigue disponible?`)}
                      target="_blank" rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      style={{ background: "#25D366", color: "#0B3B1F", width: 34, height: 34, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}
                      aria-label="Consultar por WhatsApp"
                    >
                      <MessageCircle size={17} fill="#0B3B1F" strokeWidth={0} />
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Floating general WhatsApp */}
      <a
        href={waLink(WHATSAPP_SITE_NUMBER, "Hola! Te escribo desde facetoface.online, tengo una consulta.")}
        target="_blank" rel="noopener noreferrer"
        style={{ position: "fixed", bottom: 22, right: 22, background: "#25D366", width: 54, height: 54, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 6px 18px rgba(0,0,0,0.4)", zIndex: 30 }}
        aria-label="Consultas generales por WhatsApp"
      >
        <MessageCircle size={26} color="#0B3B1F" fill="#0B3B1F" strokeWidth={0} />
      </a>

      {/* Toast */}
      {toast && (
        <div style={{ position: "fixed", bottom: 90, left: "50%", transform: "translateX(-50%)", background: "#F5F3EE", color: "#14161A", padding: "10px 18px", borderRadius: 8, fontSize: 13, fontWeight: 500, zIndex: 60 }}>
          {toast}
        </div>
      )}

      {/* Detail modal */}
      {detail && (
        <div onClick={() => setDetail(null)} style={overlayStyle}>
          <div onClick={(e) => e.stopPropagation()} style={{ ...modalStyle, maxWidth: 560 }}>
            <button onClick={() => setDetail(null)} style={closeBtnStyle}><X size={18} /></button>
            <div style={{ position: "relative", aspectRatio: "4/3", background: "#0F1013" }}>
              <img src={detail.images[detailImgIdx]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              {detail.images.length > 1 && (
                <>
                  <button onClick={() => setDetailImgIdx((i) => (i - 1 + detail.images.length) % detail.images.length)} style={{ ...navBtnStyle, left: 10 }}><ChevronLeft size={20} /></button>
                  <button onClick={() => setDetailImgIdx((i) => (i + 1) % detail.images.length)} style={{ ...navBtnStyle, right: 10 }}><ChevronRight size={20} /></button>
                  <div style={{ position: "absolute", bottom: 10, left: "50%", transform: "translateX(-50%)", display: "flex", gap: 5 }}>
                    {detail.images.map((_, i) => (
                      <span key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: i === detailImgIdx ? "#FFB020" : "rgba(255,255,255,0.4)" }} />
                    ))}
                  </div>
                </>
              )}
            </div>
            <div style={{ padding: 22 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                <div>
                  <div style={{ fontFamily: "'Oswald',sans-serif", fontSize: 22, fontWeight: 700 }}>{detail.brand} {detail.model}</div>
                  <div style={{ fontSize: 13, color: "#8B909B", marginTop: 4 }}>{detail.year} · {fmtKm(detail.km, detail.condition)} · {detail.fuel}</div>
                </div>
                <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 20, fontWeight: 600, color: "#FFB020", whiteSpace: "nowrap" }}>{fmtPrice(detail.price)}</span>
              </div>
              {detail.description && (
                <p style={{ fontSize: 14, color: "#C9CCD3", lineHeight: 1.6, marginTop: 14 }}>{detail.description}</p>
              )}
              <a
                href={waLink(detail.phone, `Hola! Vi el ${detail.brand} ${detail.model} (${detail.year}) publicado en facetoface.online, ¿sigue disponible?`)}
                target="_blank" rel="noopener noreferrer"
                className="ff-btn-primary"
                style={{ marginTop: 20, background: "#25D366", color: "#0B3B1F", border: "none", borderRadius: 8, padding: "13px 18px", fontWeight: 600, fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, textDecoration: "none" }}
              >
                <MessageCircle size={18} fill="#0B3B1F" strokeWidth={0} /> Consultar por WhatsApp
              </a>
              <button
                onClick={() => deleteListing(detail.id)}
                style={{ marginTop: 10, width: "100%", background: "transparent", border: "1px solid #3A2222", color: "#D97757", borderRadius: 8, padding: "10px", fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, cursor: "pointer" }}
              >
                <Trash2 size={14} /> Eliminar publicación
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Form modal */}
      {showForm && (
        <div onClick={() => !saving && setShowForm(false)} style={overlayStyle}>
          <div onClick={(e) => e.stopPropagation()} style={{ ...modalStyle, maxWidth: 480, maxHeight: "88vh", overflowY: "auto" }} className="ff-scroll">
            <button onClick={() => setShowForm(false)} style={closeBtnStyle}><X size={18} /></button>
            <div style={{ padding: 22 }}>
              <div style={{ fontFamily: "'Oswald',sans-serif", fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Publicar auto</div>
              <div style={{ fontSize: 13, color: "#8B909B", marginBottom: 18 }}>Se publica al instante, visible para todos.</div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                <input placeholder="Marca *" value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} style={inputStyle} />
                <input placeholder="Modelo *" value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} style={inputStyle} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                <select value={form.condition} onChange={(e) => setForm({ ...form, condition: e.target.value })} style={inputStyle}>
                  <option value="0km">0km</option>
                  <option value="usado">Usado</option>
                </select>
                <input placeholder="Año" type="number" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} style={inputStyle} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                <input placeholder="Precio (ARS)" type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} style={inputStyle} />
                <input placeholder="Kilómetros" type="number" disabled={form.condition === "0km"} value={form.condition === "0km" ? "" : form.km} onChange={(e) => setForm({ ...form, km: e.target.value })} style={{ ...inputStyle, opacity: form.condition === "0km" ? 0.4 : 1 }} />
              </div>
              <select value={form.fuel} onChange={(e) => setForm({ ...form, fuel: e.target.value })} style={{ ...inputStyle, width: "100%", marginBottom: 10 }}>
                {["Nafta", "Diesel", "GNC", "Híbrido", "Eléctrico"].map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
              <textarea placeholder="Descripción (estado, extras, etc.)" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} style={{ ...inputStyle, width: "100%", minHeight: 70, resize: "vertical", marginBottom: 10 }} />
              <input placeholder="WhatsApp del vendedor * (ej: 5491122334455)" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/[^\d]/g, "") })} style={{ ...inputStyle, width: "100%", marginBottom: 14 }} />

              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 12, color: "#8B909B", marginBottom: 8 }}>Fotos * (hasta 4)</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {form.images.map((img, i) => (
                    <div key={i} style={{ position: "relative", width: 68, height: 68 }}>
                      <img src={img} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 6 }} />
                      <button onClick={() => setForm((f) => ({ ...f, images: f.images.filter((_, idx) => idx !== i) }))} style={{ position: "absolute", top: -6, right: -6, background: "#E4572E", border: "none", borderRadius: "50%", width: 20, height: 20, color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                  {form.images.length < 4 && (
                    <button onClick={() => fileInputRef.current.click()} style={{ width: 68, height: 68, borderRadius: 6, border: "1px dashed #3A3E47", background: "transparent", color: "#8B909B", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Camera size={20} />
                    </button>
                  )}
                </div>
                <input ref={fileInputRef} type="file" accept="image/*" multiple hidden onChange={(e) => handleFiles(e.target.files)} />
              </div>

              <button onClick={submitListing} disabled={saving} className="ff-btn-primary" style={{ width: "100%", background: "#FFB020", color: "#14161A", border: "none", borderRadius: 8, padding: "13px", fontWeight: 600, fontSize: 14, cursor: saving ? "default" : "pointer", opacity: saving ? 0.7 : 1 }}>
                {saving ? "Publicando..." : "Publicar ahora"}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Sell modal */}
      {showSell && (
        <div onClick={() => setShowSell(false)} style={overlayStyle}>
          <div onClick={(e) => e.stopPropagation()} style={{ ...modalStyle, maxWidth: 460, maxHeight: "88vh", overflowY: "auto" }} className="ff-scroll">
            <button onClick={() => setShowSell(false)} style={closeBtnStyle}><X size={18} /></button>
            <div style={{ padding: 22 }}>
              <div style={{ fontFamily: "'Oswald',sans-serif", fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Vendé tu usado</div>
              <div style={{ fontSize: 13, color: "#8B909B", marginBottom: 18 }}>Contanos sobre tu auto y te contactamos por WhatsApp para tasarlo.</div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                <input placeholder="Marca *" value={sellForm.brand} onChange={(e) => setSellForm({ ...sellForm, brand: e.target.value })} style={inputStyle} />
                <input placeholder="Modelo *" value={sellForm.model} onChange={(e) => setSellForm({ ...sellForm, model: e.target.value })} style={inputStyle} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                <input placeholder="Año" type="number" value={sellForm.year} onChange={(e) => setSellForm({ ...sellForm, year: e.target.value })} style={inputStyle} />
                <input placeholder="Kilómetros" type="number" value={sellForm.km} onChange={(e) => setSellForm({ ...sellForm, km: e.target.value })} style={inputStyle} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                <select value={sellForm.fuel} onChange={(e) => setSellForm({ ...sellForm, fuel: e.target.value })} style={inputStyle}>
                  {["Nafta", "Diesel", "GNC", "Híbrido", "Eléctrico"].map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
                <select value={sellForm.state} onChange={(e) => setSellForm({ ...sellForm, state: e.target.value })} style={inputStyle}>
                  {["Excelente", "Muy bueno", "Bueno", "Regular", "Para repuestos"].map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <textarea placeholder="Comentarios (service al día, detalles, etc.)" value={sellForm.notes} onChange={(e) => setSellForm({ ...sellForm, notes: e.target.value })} style={{ ...inputStyle, width: "100%", minHeight: 60, resize: "vertical", marginBottom: 10 }} />
              <input placeholder="Tu WhatsApp * (ej: 5491122334455)" value={sellForm.phone} onChange={(e) => setSellForm({ ...sellForm, phone: e.target.value.replace(/[^\d]/g, "") })} style={{ ...inputStyle, width: "100%", marginBottom: 16 }} />

              <button onClick={sendSellRequest} className="ff-btn-primary" style={{ width: "100%", background: "#25D366", color: "#0B3B1F", border: "none", borderRadius: 8, padding: "13px", fontWeight: 600, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                <MessageCircle size={18} fill="#0B3B1F" strokeWidth={0} /> Enviar por WhatsApp
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const selStyle = { background: "#1E2127", border: "1px solid #2C3038", borderRadius: 8, padding: "10px 12px", color: "#F5F3EE", fontSize: 14 };
const inputStyle = { background: "#14161A", border: "1px solid #2C3038", borderRadius: 8, padding: "10px 12px", color: "#F5F3EE", fontSize: 14, fontFamily: "inherit" };
const overlayStyle = { position: "fixed", inset: 0, background: "rgba(10,11,13,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 };
const modalStyle = { background: "#1A1C21", border: "1px solid #2C3038", borderRadius: 14, width: "100%", position: "relative" };
const closeBtnStyle = { position: "absolute", top: 12, right: 12, background: "rgba(20,22,26,0.7)", border: "none", borderRadius: 8, width: 32, height: 32, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", zIndex: 5 };
const navBtnStyle = { position: "absolute", top: "50%", transform: "translateY(-50%)", background: "rgba(20,22,26,0.7)", border: "none", borderRadius: "50%", width: 34, height: 34, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" };
