'use client';

import { useState, useRef, useEffect } from 'react';
import {
  Send,
  Bot,
  User,
  Loader2,
  FileText,
  BookOpen,
  HelpCircle,
  AlertCircle,
  ChevronRight,
  Maximize2,
  Eye,
  EyeOff,
  Filter,
} from 'lucide-react';
import { askChatAction, getPojistovnyAction } from '@/app/actions';

interface Message {
  id: string;
  role: 'user' | 'model';
  content: string;
  chunks?: {
    id: string;
    obsah: string;
    pojistovna: string;
    nazev_dokumentu: string;
    strana?: number;
    podobnost: number;
  }[];
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'model',
      content:
        'Dobrý den! Jsem Váš AI asistent pro analýzu pojistných podmínek. Můžete se mě zeptat na jakékoliv detaily ohledně nahraných pojištění (např. čekací doby, definice invalidity, výluky). Odpovídat budu výhradně na základě nahraných dokumentů.',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [pojistovny, setPojistovny] = useState<string[]>([]);
  const [vybranaPojistovna, setVybranaPojistovna] = useState<string>(''); // '' = všechny
  const [activeSourceChunk, setActiveSourceChunk] = useState<{
    obsah: string;
    pojistovna: string;
    nazev_dokumentu: string;
    strana?: number;
  } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const sampleQuestions = [
    'Jaká je čekací doba pro pojištění invalidity?',
    'Jaké jsou výluky u pojištění pracovní neschopnosti?',
    'Definuje pojišťovna infarkt jako vážné onemocnění?',
    'Které sporty jsou zařazeny ve výlukách?',
  ];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  // Načtení seznamu pojišťoven pro filtr
  useEffect(() => {
    getPojistovnyAction()
      .then((res) => {
        if (res.success) setPojistovny(res.pojistovny);
      })
      .catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userQuery = input.trim();
    setInput('');
    
    // Add user message
    const userMessageId = Math.random().toString();
    const newMessages: Message[] = [
      ...messages,
      { id: userMessageId, role: 'user', content: userQuery },
    ];
    setMessages(newMessages);
    setLoading(true);

    try {
      // Map current messages to the history expected by the Gemini API
      // excluding the welcome message and sending last 10 messages for context
      const chatHistory = newMessages
        .slice(1) // exclude welcome message
        .map((msg) => ({
          role: msg.role,
          content: msg.content,
        }));

      const res = await askChatAction(userQuery, chatHistory, vybranaPojistovna || null);

      if (res.success) {
        setMessages((prev) => [
          ...prev,
          {
            id: Math.random().toString(),
            role: 'model',
            content: res.answer,
            chunks: res.chunks,
          },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: Math.random().toString(),
            role: 'model',
            content: `Omlouvám se, ale při zpracování dotazu nastala chyba: ${res.error || 'Neznámá chyba API'}. Ujistěte se, že jsou nahrány dokumenty a správně nakonfigurován .env.local.`,
          },
        ]);
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: Math.random().toString(),
          role: 'model',
          content: `Neočekávaná chyba: ${err instanceof Error ? err.message : String(err)}`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleSampleClick = (question: string) => {
    setInput(question);
  };

  // Rendering bold/italic and lists in simple markdown helper
  const renderMarkdown = (text: string) => {
    // Basic Markdown parser for simple elements
    const lines = text.split('\n');
    return lines.map((line, idx) => {
      let content = line;
      
      // Headers (e.g. ### Title)
      if (content.startsWith('### ')) {
        return <h4 key={idx} className="text-base font-bold text-primary mt-3 mb-1">{content.replace('### ', '')}</h4>;
      }
      if (content.startsWith('## ')) {
        return <h3 key={idx} className="text-lg font-bold text-primary mt-4 mb-2">{content.replace('## ', '')}</h3>;
      }
      if (content.startsWith('# ')) {
        return <h2 key={idx} className="text-xl font-bold text-primary mt-5 mb-2">{content.replace('# ', '')}</h2>;
      }

      // Bullet points
      if (content.startsWith('- ') || content.startsWith('* ')) {
        const cleaned = content.substring(2);
        return (
          <ul key={idx} className="list-disc pl-5 my-1 text-sm leading-relaxed text-slate-800">
            <li>{parseInlineStyles(cleaned)}</li>
          </ul>
        );
      }

      // Ordered list (numbered)
      const numberRegex = /^\d+\.\s/;
      if (numberRegex.test(content)) {
        const cleaned = content.replace(numberRegex, '');
        const num = content.match(/^\d+/) || '1';
        return (
          <ol key={idx} className="list-decimal pl-5 my-1 text-sm leading-relaxed text-slate-800" start={parseInt(num[0])}>
            <li>{parseInlineStyles(cleaned)}</li>
          </ol>
        );
      }

      // Empty line
      if (content.trim() === '') {
        return <div key={idx} className="h-2" />;
      }

      return (
        <p key={idx} className="text-sm leading-relaxed text-slate-800 my-1">
          {parseInlineStyles(content)}
        </p>
      );
    });
  };

  const parseInlineStyles = (text: string) => {
    // Matches **bold text**
    const parts = [];
    let currentIndex = 0;
    
    // Quick regex scanner
    const boldRegex = /\*\*([^*]+)\*\*/g;
    let match;
    
    while ((match = boldRegex.exec(text)) !== null) {
      const matchIndex = match.index;
      // Add text before the match
      if (matchIndex > currentIndex) {
        parts.push(text.substring(currentIndex, matchIndex));
      }
      // Add bold text
      parts.push(
        <strong key={matchIndex} className="font-extrabold text-primary">
          {match[1]}
        </strong>
      );
      currentIndex = boldRegex.lastIndex;
    }
    
    if (currentIndex < text.length) {
      parts.push(text.substring(currentIndex));
    }
    
    return parts.length > 0 ? parts : text;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-[calc(100vh-8.5rem)] min-h-[500px] animate-fade-in">
      
      {/* Left pane: Quick samples & active source preview */}
      <div className="lg:col-span-1 flex flex-col gap-4 order-2 lg:order-1">
        
        {/* Quick Suggestions */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm flex flex-col">
          <h3 className="text-sm font-bold text-primary mb-3 flex items-center gap-1.5">
            <HelpCircle className="h-4 w-4 text-accent" />
            Časté dotazy
          </h3>
          <div className="flex flex-wrap lg:flex-col gap-2">
            {sampleQuestions.map((q, idx) => (
              <button
                key={idx}
                onClick={() => handleSampleClick(q)}
                className="text-left text-xs bg-slate-50 hover:bg-primary-50 hover:text-primary border border-slate-200 hover:border-primary-100 rounded-lg p-2.5 transition-all duration-200 leading-snug cursor-pointer flex items-center gap-1"
              >
                <ChevronRight className="h-3 w-3 shrink-0 text-slate-400" />
                <span>{q}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Source Text Inspector */}
        {activeSourceChunk ? (
          <div className="rounded-xl border border-primary-100 bg-primary-50/50 p-4 shadow-sm flex-1 flex flex-col overflow-hidden animate-fade-in">
            <div className="flex items-center justify-between mb-2 pb-2 border-b border-primary-100 shrink-0">
              <span className="text-xs font-bold text-primary flex items-center gap-1">
                <BookOpen className="h-3.5 w-3.5 text-accent" />
                Náhled zdroje
              </span>
              <button
                onClick={() => setActiveSourceChunk(null)}
                className="text-xs text-slate-400 hover:text-primary font-semibold"
              >
                Zavřít
              </button>
            </div>
            <div className="text-[11px] text-slate-500 mb-2 font-medium shrink-0">
              <span className="font-bold text-slate-800">Pojišťovna:</span> {activeSourceChunk.pojistovna}
              <br />
              <span className="font-bold text-slate-800">Dokument:</span> {activeSourceChunk.nazev_dokumentu}
              {activeSourceChunk.strana && (
                <>
                  <br />
                  <span className="font-bold text-slate-800">Strana:</span> {activeSourceChunk.strana}
                </>
              )}
            </div>
            <div className="flex-1 overflow-y-auto text-xs text-slate-700 bg-white p-3 rounded-lg border border-slate-200/60 leading-relaxed font-mono whitespace-pre-line">
              {activeSourceChunk.obsah}
            </div>
          </div>
        ) : (
          <div className="hidden lg:flex rounded-xl border border-dashed border-slate-200 p-6 flex-1 flex-col items-center justify-center text-center text-slate-400">
            <BookOpen className="h-8 w-8 mb-2 text-slate-300" />
            <p className="text-xs font-medium">Klikněte na zdroj pod odpovědí AI pro zobrazení původního textu z pojistných podmínek.</p>
          </div>
        )}
      </div>

      {/* Right/Center pane: Chat window */}
      <div className="lg:col-span-3 flex flex-col border border-slate-200 rounded-xl bg-white shadow-sm overflow-hidden h-full order-1 lg:order-2">
        {/* Chat Header */}
        <div className="bg-primary text-white py-3 px-4 flex items-center gap-3 shrink-0">
          <div className="h-9 w-9 rounded-lg bg-primary-800 flex items-center justify-center border border-primary-600">
            <Bot className="h-5 w-5 text-accent" />
          </div>
          <div>
            <h2 className="text-sm font-bold leading-tight">Analytický chat o pojistných podmínkách</h2>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
              <span className="text-[10px] font-semibold text-primary-100">RAG model aktivní</span>
            </div>
          </div>
        </div>

        {/* Message Container */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3 max-w-[85%] ${msg.role === 'user' ? 'ml-auto flex-row-reverse' : ''}`}
            >
              {/* Avatar */}
              <div
                className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${
                  msg.role === 'user' ? 'bg-accent text-white' : 'bg-primary text-white'
                }`}
              >
                {msg.role === 'user' ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
              </div>

              {/* Message Bubble */}
              <div className="space-y-2">
                <div
                  className={`rounded-2xl px-4 py-2.5 text-sm shadow-sm ${
                    msg.role === 'user'
                      ? 'bg-primary text-white rounded-tr-none'
                      : 'bg-white text-slate-800 border border-slate-100 rounded-tl-none'
                  }`}
                >
                  {msg.role === 'user' ? msg.content : renderMarkdown(msg.content)}
                </div>

                {/* Sources list (only for AI replies with chunks) */}
                {msg.role === 'model' && msg.chunks && msg.chunks.length > 0 && (
                  <div className="pl-2 flex flex-col gap-1.5">
                    <span className="text-[10px] font-bold text-slate-400 tracking-wider uppercase">Použité podklady (RAG):</span>
                    <div className="flex flex-wrap gap-1.5">
                      {msg.chunks.map((chunk, idx) => (
                        <button
                          key={chunk.id}
                          onClick={() => setActiveSourceChunk(chunk)}
                          className="inline-flex items-center gap-1 text-[11px] font-medium bg-white hover:bg-primary-50 text-slate-600 hover:text-primary border border-slate-200 hover:border-primary-200 rounded-md px-2 py-0.5 transition-colors cursor-pointer shadow-sm"
                          title="Zobrazit zdrojový text"
                        >
                          <FileText className="h-3 w-3 text-slate-400" />
                          <span className="font-semibold text-slate-700">{chunk.pojistovna}</span>
                          <span className="text-slate-400">| s. {chunk.strana || '?'}</span>
                          <span className="text-[10px] text-green-600 font-semibold">({Math.round(chunk.podobnost * 100)}%)</span>
                          <Eye className="h-2.5 w-2.5 ml-0.5 text-slate-400" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex gap-3 max-w-[85%]">
              <div className="h-8 w-8 rounded-full bg-primary text-white flex items-center justify-center shrink-0">
                <Bot className="h-4 w-4" />
              </div>
              <div className="bg-white border border-slate-100 rounded-2xl rounded-tl-none px-4 py-2.5 text-sm shadow-sm flex items-center gap-2 text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                Vyhledávám v podmínkách a tvořím odpověď...
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Filtr pojišťovny + Input Form */}
        <div className="border-t border-slate-200 bg-white shrink-0">
          {pojistovny.length > 0 && (
            <div className="px-3 pt-2.5 flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
                <Filter className="h-3.5 w-3.5 text-accent" />
                Hledat ve zdroji:
              </span>
              <select
                value={vybranaPojistovna}
                onChange={(e) => setVybranaPojistovna(e.target.value)}
                disabled={loading}
                className="text-xs rounded-md border border-slate-200 px-2 py-1 text-slate-700 focus:border-primary focus:outline-none cursor-pointer bg-white"
              >
                <option value="">Všechny pojišťovny</option>
                {pojistovny.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
          )}
          <form onSubmit={handleSubmit} className="p-3 flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Zeptejte se na pojistné podmínky (např. invalidita Generali)..."
              aria-label="Dotaz na pojistné podmínky"
              className="flex-1 rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm focus:border-primary focus:outline-none placeholder-slate-400"
              disabled={loading}
            />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            aria-label="Odeslat dotaz"
            title="Odeslat dotaz"
            className={`flex items-center justify-center rounded-lg px-4 text-white transition-all duration-200 ${
              loading || !input.trim()
                ? 'bg-slate-300 cursor-not-allowed'
                : 'bg-primary hover:bg-primary-600 shadow-sm cursor-pointer'
            }`}
          >
            <Send className="h-4 w-4 text-accent" />
          </button>
          </form>
        </div>
      </div>
    </div>
  );
}
