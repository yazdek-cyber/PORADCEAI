'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Upload,
  Trash2,
  FileText,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Database,
  Calendar,
  Layers,
  HelpCircle,
  ExternalLink,
  Globe,
  RefreshCw,
  Download,
  Sparkles,
} from 'lucide-react';
import {
  getDocumentsAction,
  uploadDocumentAction,
  deleteDocumentAction,
  zkontrolujPodminkyAction,
  getDostupnePodminkyAction,
  importujPodminkuAction,
} from '@/app/actions';
import { najdiOdkazPodminek } from '@/lib/pojistovny';

interface Document {
  id: string;
  nazev: string;
  pojistovna: string;
  nahrano_kdy: string;
  pocet_chunku: number;
}

interface DostupnaPodminka {
  id: string;
  pojistovna: string;
  produkt: string | null;
  nazev: string;
  url: string;
  stav: 'nova' | 'zmenena' | 'importovana';
  posledni_videno: string;
}

export default function AdminPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Form states
  const [pojistovna, setPojistovna] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);

  // Alert/Status states
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Config check state
  const [isConfigured, setIsConfigured] = useState<boolean | null>(null);
  const [configDetails, setConfigDetails] = useState<{
    geminiKey: boolean;
    supabaseUrl: boolean;
    supabaseAnonKey: boolean;
    supabaseServiceKey: boolean;
  }>({
    geminiKey: false,
    supabaseUrl: false,
    supabaseAnonKey: false,
    supabaseServiceKey: false,
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Monitor podmínek pojišťoven
  const [dostupne, setDostupne] = useState<DostupnaPodminka[]>([]);
  const [scanning, setScanning] = useState(false);
  const [scanSouhrn, setScanSouhrn] = useState<string | null>(null);
  const [importujeId, setImportujeId] = useState<string | null>(null);

  const fetchDostupne = async () => {
    const res = await getDostupnePodminkyAction();
    if (res.success) setDostupne(res.podminky as DostupnaPodminka[]);
  };

  const handleScan = async () => {
    setScanning(true);
    setScanSouhrn(null);
    setError(null);
    try {
      const res = await zkontrolujPodminkyAction();
      if (res.success) {
        const nove = res.souhrn.reduce((a, s) => a + (s.nove || 0), 0);
        const zmenene = res.souhrn.reduce((a, s) => a + (s.zmenene || 0), 0);
        const chyby = res.souhrn.filter((s) => s.chyba).map((s) => s.pojistovna);
        setScanSouhrn(
          `Kontrola hotová: ${nove} nových, ${zmenene} změněných dokumentů.` +
            (chyby.length ? ` Nepodařilo se načíst: ${chyby.join(', ')}.` : '')
        );
        await fetchDostupne();
      } else {
        setError('Kontrola se nezdařila.');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chyba při kontrole podmínek.');
    } finally {
      setScanning(false);
    }
  };

  const handleImport = async (id: string) => {
    setImportujeId(id);
    setError(null);
    try {
      const res = await importujPodminkuAction(id);
      if (res.success) {
        setSuccess(
          `Dokument importován (${res.chunkCount} částí).` +
            (res.pouzitoOcr ? ' (přes OCR)' : '')
        );
        await Promise.all([fetchDostupne(), fetchDocuments()]);
      } else {
        setError(res.error || 'Import se nezdařil.');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chyba při importu.');
    } finally {
      setImportujeId(null);
    }
  };

  const fetchDocuments = async () => {
    setLoading(true);
    const res = await getDocumentsAction();
    if (res.success) {
      setDocuments(res.documents as Document[]);
      setError(null);
    } else {
      setError(res.error || 'Nepodařilo se načíst dokumenty.');
    }
    setLoading(false);
  };

  const checkConfig = async () => {
    try {
      const res = await fetch('/api/check-config');
      const data = await res.json();
      setIsConfigured(data.configured);
      
      // Check individual variables
      fetch('/api/check-config-details')
        .then((r) => r.json())
        .then((details) => {
          setConfigDetails(details);
        })
        .catch(() => {});
    } catch {
      setIsConfigured(false);
    }
  };

  useEffect(() => {
    checkConfig();
    fetchDocuments();
    fetchDostupne();
  }, []);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.type === 'application/pdf') {
        setFile(droppedFile);
        setError(null);
      } else {
        setError('Lze nahrát pouze soubory PDF.');
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError(null);
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError('Vyberte prosím PDF soubor k nahrání.');
      return;
    }
    if (!pojistovna.trim()) {
      setError('Vyplňte prosím název pojišťovny.');
      return;
    }
    // Klientská validace (srozumitelná hláška dřív, než to dojde na server)
    const MAX_MB = 20;
    const jePdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    if (!jePdf) {
      setError('Nahrávat lze pouze soubory ve formátu PDF.');
      return;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      setError(
        `Soubor je příliš velký (${(file.size / 1048576).toFixed(1)} MB). Maximum je ${MAX_MB} MB.`
      );
      return;
    }

    setUploading(true);
    setError(null);
    setSuccess(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('pojistovna', pojistovna.trim());

    try {
      const result = await uploadDocumentAction(formData);
      if (result.success) {
        setSuccess(
          `Dokument byl úspěšně zpracován a rozdělen na ${result.chunkCount} částí.` +
            (result.pouzitoOcr ? ' (Naskenované PDF — text byl získán přes OCR.)' : '')
        );
        setFile(null);
        setPojistovna('');
        if (fileInputRef.current) fileInputRef.current.value = '';
        fetchDocuments();
      } else {
        setError(result.error || 'Neznámá chyba při nahrávání.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nastala neočekávaná chyba.');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Opravdu chcete smazat dokument "${name}"? Všechny přidružené textové části a vektorové indexy budou nenávratně odstraněny.`)) {
      return;
    }

    setDeletingId(id);
    setError(null);
    setSuccess(null);

    try {
      const result = await deleteDocumentAction(id);
      if (result.success) {
        setSuccess('Dokument byl úspěšně smazán.');
        fetchDocuments();
      } else {
        setError(result.error || 'Nepodařilo se smazat dokument.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nastala neočekávaná chyba při mazání.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Title */}
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-primary">Správa pojistných podmínek</h1>
        <p className="mt-2 text-slate-600">
          Nahrajte PDF dokumenty pojistných podmínek. Systém z nich automaticky extrahuje text, rozdělí jej na logické části (chunky) a vytvoří vektorové embeddingy pro RAG vyhledávání.
        </p>
      </div>

      {/* Notifications */}
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
          <div className="text-sm text-red-800">
            <span className="font-semibold">Chyba:</span> {error}
          </div>
        </div>
      )}

      {success && (
        <div className="rounded-lg bg-green-50 border border-green-200 p-4 flex items-start gap-3">
          <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
          <div className="text-sm text-green-800">
            <span className="font-semibold">Úspěch:</span> {success}
          </div>
        </div>
      )}

      {/* Config Check Box (if missing variables) */}
      {isConfigured === false && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 space-y-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 text-amber-900">
              <Database className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-amber-900">Chybí konfigurace prostředí</h2>
              <p className="text-xs text-amber-700">Nastavte klíče v souboru <code>.env.local</code> v kořenu projektu a restartujte vývojový server.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${configDetails.geminiKey ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className="text-slate-700">GEMINI_API_KEY</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${configDetails.supabaseUrl ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className="text-slate-700">NEXT_PUBLIC_SUPABASE_URL</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${configDetails.supabaseAnonKey ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className="text-slate-700">NEXT_PUBLIC_SUPABASE_ANON_KEY</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${configDetails.supabaseServiceKey ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className="text-slate-700">SUPABASE_SERVICE_ROLE_KEY</span>
            </div>
          </div>

          <div className="pt-2 border-t border-amber-200">
            <p className="text-xs font-semibold text-slate-700 mb-2">SQL pro inicializaci Supabase databáze:</p>
            <pre className="max-h-40 overflow-y-auto bg-slate-900 text-slate-200 p-3 rounded-lg text-xs font-mono select-all">
{`CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE dokumenty (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nazev TEXT NOT NULL,
  pojistovna TEXT,
  nahrano_kdy TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  pocet_chunku INTEGER DEFAULT 0
);

CREATE TABLE chunky (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  dokument_id UUID REFERENCES dokumenty(id) ON DELETE CASCADE,
  obsah TEXT NOT NULL,
  embedding VECTOR(768),
  strana INTEGER,
  poradi INTEGER,
  pojistovna TEXT,
  nazev_dokumentu TEXT
);

CREATE INDEX ON chunky USING hnsw (embedding vector_cosine_ops);

CREATE OR REPLACE FUNCTION hledej_chunky(
  dotaz_embedding VECTOR(768),
  pocet INTEGER DEFAULT 8
)
RETURNS TABLE (
  id UUID,
  obsah TEXT,
  pojistovna TEXT,
  nazev_dokumentu TEXT,
  strana INTEGER,
  podobnost FLOAT
)
LANGUAGE sql
AS $$
  SELECT
    chunky.id,
    chunky.obsah,
    chunky.pojistovna,
    chunky.nazev_dokumentu,
    chunky.strana,
    1 - (chunky.embedding <=> dotaz_embedding) AS podobnost
  FROM chunky
  ORDER BY chunky.embedding <=> dotaz_embedding
  LIMIT pocet;
$$;`}
            </pre>
          </div>
        </div>
      )}

      {/* Main Grid: Upload Form + Document List */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Upload Column */}
        <div className="lg:col-span-1 space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold text-primary mb-4 flex items-center gap-2">
              <Upload className="h-5 w-5 text-accent" />
              Nahrát dokument
            </h2>

            <form onSubmit={handleUploadSubmit} className="space-y-4">
              <div>
                <label htmlFor="pojistovna" className="block text-sm font-semibold text-slate-700 mb-1">
                  Pojišťovna *
                </label>
                <input
                  type="text"
                  id="pojistovna"
                  value={pojistovna}
                  onChange={(e) => setPojistovna(e.target.value)}
                  placeholder="Např. Generali, Allianz, Kooperativa"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary focus:outline-none"
                  required
                  disabled={uploading}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  PDF Soubor pojistných podmínek *
                </label>
                
                <div
                  onDragEnter={handleDrag}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-6 cursor-pointer transition-all duration-200 ${
                    dragActive
                      ? 'border-accent bg-amber-50'
                      : 'border-slate-300 hover:border-primary hover:bg-slate-50'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf"
                    onChange={handleFileChange}
                    className="hidden"
                    disabled={uploading}
                  />
                  <FileText className={`h-10 w-10 mb-2 ${file ? 'text-accent' : 'text-slate-400'}`} />
                  
                  {file ? (
                    <div className="text-center">
                      <p className="text-sm font-semibold text-slate-800 line-clamp-1 max-w-[200px]">{file.name}</p>
                      <p className="text-xs text-slate-500">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
                    </div>
                  ) : (
                    <div className="text-center">
                      <p className="text-sm font-medium text-slate-700">Přetáhněte PDF sem, nebo klikněte</p>
                      <p className="text-xs text-slate-400 mt-1">Pouze soubory .pdf</p>
                    </div>
                  )}
                </div>
              </div>

              <button
                type="submit"
                disabled={uploading || !file || !pojistovna.trim() || isConfigured === false}
                className={`w-full flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-bold text-white transition-all duration-200 ${
                  uploading || !file || !pojistovna.trim() || isConfigured === false
                    ? 'bg-slate-300 cursor-not-allowed'
                    : 'bg-primary hover:bg-primary-600 shadow-sm active:scale-98'
                }`}
              >
                {uploading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin text-accent" />
                    Zpracovávám PDF...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 text-accent" />
                    Zpracovat a indexovat
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* List Column */}
        <div className="lg:col-span-2 space-y-6">

          {/* Monitor podmínek pojišťoven */}
          <div className="rounded-xl border border-primary-100 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <h2 className="text-xl font-bold text-primary flex items-center gap-2">
                <Globe className="h-5 w-5 text-accent" />
                Podmínky pojišťoven (monitor)
              </h2>
              <button
                onClick={handleScan}
                disabled={scanning}
                className={`flex items-center gap-1.5 text-xs font-bold rounded-lg px-3 py-2 transition-colors ${
                  scanning
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    : 'bg-primary text-white hover:bg-primary-600 cursor-pointer'
                }`}
              >
                {scanning ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5 text-accent" />
                )}
                {scanning ? 'Kontroluji…' : 'Zkontrolovat nové podmínky'}
              </button>
            </div>
            <p className="text-xs text-slate-500 mb-3">
              Projde weby pojišťoven (Kooperativa, NN, Generali, UNIQA, Allianz, ČPP…), najde
              dostupné dokumenty a označí nové či změněné. Importuj jedním klikem.
            </p>
            {scanSouhrn && (
              <div className="mb-3 text-xs bg-primary-50 border border-primary-100 text-primary rounded-lg px-3 py-2">
                {scanSouhrn}
              </div>
            )}

            {dostupne.length === 0 ? (
              <div className="text-center py-8 border border-dashed border-slate-200 rounded-lg">
                <Sparkles className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-slate-600">
                  Zatím nic nenalezeno. Klikni na „Zkontrolovat nové podmínky".
                </p>
              </div>
            ) : (
              <div className="space-y-1.5 max-h-[420px] overflow-y-auto pr-1">
                {dostupne.map((d) => (
                  <div
                    key={d.id}
                    className="flex items-center gap-2 rounded-lg border border-slate-200 p-2.5 text-sm hover:bg-slate-50"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-semibold text-slate-800 truncate">{d.nazev}</span>
                        {d.stav === 'nova' && (
                          <span className="text-[10px] font-bold text-green-700 bg-green-50 border border-green-200 rounded px-1.5 py-0.5">
                            🆕 nová
                          </span>
                        )}
                        {d.stav === 'zmenena' && (
                          <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">
                            ✏️ změněná
                          </span>
                        )}
                        {d.stav === 'importovana' && (
                          <span className="text-[10px] font-bold text-slate-500 bg-slate-100 border border-slate-200 rounded px-1.5 py-0.5">
                            ✅ importovaná
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 truncate">
                        {d.pojistovna}
                        {d.produkt ? ` · ${d.produkt}` : ''}
                      </div>
                    </div>
                    <a
                      href={d.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-slate-400 hover:text-primary p-1"
                      title="Otevřít PDF"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                    <button
                      onClick={() => handleImport(d.id)}
                      disabled={importujeId === d.id}
                      className={`flex items-center gap-1 text-xs font-bold rounded-md px-2.5 py-1.5 transition-colors ${
                        importujeId === d.id
                          ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                          : d.stav === 'importovana'
                            ? 'bg-slate-100 text-slate-500 hover:bg-slate-200 cursor-pointer'
                            : 'bg-primary-50 text-primary hover:bg-primary-100 cursor-pointer'
                      }`}
                      title={d.stav === 'importovana' ? 'Znovu importovat' : 'Importovat do databáze'}
                    >
                      {importujeId === d.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Download className="h-3.5 w-3.5" />
                      )}
                      {d.stav === 'importovana' ? 'Znovu' : 'Importovat'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold text-primary mb-4 flex items-center gap-2">
              <FileText className="h-5 w-5 text-accent" />
              Indexované dokumenty ({documents.length})
            </h2>

            {loading ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
                <p className="text-sm">Načítám indexované dokumenty...</p>
              </div>
            ) : documents.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-slate-200 rounded-lg">
                <AlertCircle className="h-10 w-10 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-medium text-slate-600">Zatím nebyly nahrány žádné dokumenty.</p>
                <p className="text-xs text-slate-400 mt-1">Nahrajte první PDF soubor pro vyhledávání.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 font-semibold">
                      <th className="py-3 px-2">Pojišťovna</th>
                      <th className="py-3 px-2">Název dokumentu</th>
                      <th className="py-3 px-2 text-center">Částí (chunky)</th>
                      <th className="py-3 px-2">Nahráno</th>
                      <th className="py-3 px-2 text-right">Akce</th>
                    </tr>
                  </thead>
                  <tbody>
                    {documents.map((doc) => (
                      <tr key={doc.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                        <td className="py-3 px-2">
                          <span className="inline-flex items-center rounded-md bg-primary-50 px-2 py-1 text-xs font-bold text-primary border border-primary-100">
                            {doc.pojistovna}
                          </span>
                          {najdiOdkazPodminek(doc.pojistovna) && (
                            <a
                              href={najdiOdkazPodminek(doc.pojistovna)!}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-1 flex items-center gap-1 text-xs text-primary hover:underline"
                              title="Otevřít oficiální stránku s podmínkami ke stažení"
                            >
                              <ExternalLink className="h-3 w-3" />
                              Podmínky ke stažení
                            </a>
                          )}
                        </td>
                        <td className="py-3 px-2 max-w-[200px] truncate font-medium text-slate-800" title={doc.nazev}>
                          {doc.nazev}
                        </td>
                        <td className="py-3 px-2 text-center text-slate-600">
                          <span className="flex items-center justify-center gap-1">
                            <Layers className="h-3 w-3 text-slate-400" />
                            {doc.pocet_chunku}
                          </span>
                        </td>
                        <td className="py-3 px-2 text-slate-500 text-xs">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3. w-3 text-slate-400" />
                            {new Date(doc.nahrano_kdy).toLocaleDateString('cs-CZ')}
                          </span>
                        </td>
                        <td className="py-3 px-2 text-right">
                          <button
                            onClick={() => handleDelete(doc.id, doc.nazev)}
                            disabled={deletingId === doc.id}
                            className="text-slate-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 transition-colors inline-flex items-center justify-center"
                            title="Smazat dokument"
                          >
                            {deletingId === doc.id ? (
                              <Loader2 className="h-4 w-4 animate-spin text-red-600" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
