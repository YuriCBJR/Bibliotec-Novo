import React, { useState, useEffect, useCallback } from 'react';
import { useMsal } from '@azure/msal-react';
import { loginRequest } from './authConfig';
import axios from 'axios';
import { motion, AnimatePresence } from 'motion/react';
import {
    BookOpen, LogOut, Search, Plus, Trash2, RefreshCw, Sliders,
    FileText, Clock, CheckCircle, AlertTriangle, Info, Check,
    Database, Globe, Lock, Calendar, Layers, Sparkles,
} from 'lucide-react';

import { Autor, Livro, Emprestimo, AppSettings } from './types';
import { INITIAL_AUTORES, INITIAL_LIVROS, INITIAL_EMPRESTIMOS } from './data';

// CRÍTICO: lê sempre do localStorage para evitar closure stale no tokenSessao
const getTokenSalvo = () => localStorage.getItem('token_bibliotec');

export default function App() {
    let msalContext: any = null;
    try { msalContext = useMsal(); } catch (e) { console.warn("MSAL indisponível.", e); }
    const accounts = msalContext ? msalContext.accounts : [];
    const instance = msalContext ? msalContext.instance : null;
    const inProgress = msalContext ? msalContext.inProgress : 'none';

    const [settings, setSettings] = useState<AppSettings>(() => {
        const saved = localStorage.getItem('bibliotec_settings');
        if (saved) { try { return JSON.parse(saved); } catch { } }
        return { isMockMode: true, apiUrl: "https://localhost:7172/api" };
    });
    const [testConnectionStatus, setTestConnectionStatus] = useState<'idle' | 'testing' | 'success' | 'failed'>('idle');
    const [showSettingsSidebar, setShowSettingsSidebar] = useState(false);

    const [livros, setLivros] = useState<Livro[]>([]);
    const [autores, setAutores] = useState<Autor[]>([]);
    const [emprestimos, setEmprestimos] = useState<Emprestimo[]>([]);
    const [carregando, setCarregando] = useState(false);
    const [apiOffline, setApiOffline] = useState(false);
    const [abaAtiva, setAbaAtiva] = useState<'catalogo' | 'pendentes' | 'historico' | 'admin'>('catalogo');

    const [perfilUsuario, setPerfilUsuario] = useState<string | null>(null);
    const [nomeUsuario, setNomeUsuario] = useState<string | null>(null);
    const [tokenSessao, setTokenSessao] = useState<string | null>(null);

    const [mostrarAcessoLocal, setMostrarAcessoLocal] = useState(() => {
        const params = new URLSearchParams(window.location.search);
        return params.get('admin') === 'true' || window.location.hash === '#admin';
    });
    const [emailForm, setEmailForm] = useState('');
    const [senhaForm, setSenhaForm] = useState('');
    const [carregandoLogin, setCarregandoLogin] = useState(false);
    const [busca, setBusca] = useState('');
    const [apenasDisponiveis, setApenasDisponiveis] = useState(false);
    const [authorSelecionado, setAuthorSelecionado] = useState('');
    const [livroDetalhe, setLivroDetalhe] = useState<Livro | null>(null);
    const [novoLivro, setNovoLivro] = useState({ nome: '', autorId: '', genero: '', ano: '', codigo: '', resumo: '', quantidade: 1, cor: '#0082C6' });
    const [novoAutorNome, setNovoAutorNome] = useState('');
    const [mostrandoAddAutor, setMostrandoAddAutor] = useState(false);
    const [logs, setLogs] = useState<string[]>([]);

    const registrarLog = useCallback((msg: string) => {
        const timestamp = new Date().toLocaleTimeString();
        setLogs(prev => [`[${timestamp}] ${msg}`, ...prev.slice(0, 20)]);
    }, []);

    useEffect(() => {
        localStorage.setItem('bibliotec_settings', JSON.stringify(settings));
    }, [settings]);

    useEffect(() => {
        const handleUrlChange = () => {
            const params = new URLSearchParams(window.location.search);
            setMostrarAcessoLocal(params.get('admin') === 'true' || window.location.hash === '#admin');
        };
        window.addEventListener('hashchange', handleUrlChange);
        window.addEventListener('popstate', handleUrlChange);
        return () => { window.removeEventListener('hashchange', handleUrlChange); window.removeEventListener('popstate', handleUrlChange); };
    }, []);

    // Restaura sessão do localStorage — NÃO usa accounts[] para setar token
    useEffect(() => {
        const token = localStorage.getItem('token_bibliotec');
        const perfil = localStorage.getItem('perfil_bibliotec');
        const nome = localStorage.getItem('nome_usuario_comum');
        if (token && perfil) {
            setTokenSessao(token);
            setPerfilUsuario(perfil);
            setNomeUsuario(nome || 'Usuário');
            registrarLog(`Sessão restaurada como: ${perfil}`);
        }
    }, []); // eslint-disable-line

    // Processa retorno do redirect Microsoft
    useEffect(() => {
        if (!instance) return;
        instance.handleRedirectPromise().then(async (result) => {
            if (!result || !result.account) return;
            const nome = result.account.name || result.account.username;
            localStorage.removeItem('msal_redirect_pending');
            try {
                const response = await axios.post(
                    `${settings.apiUrl}/autenticacao/login-azure`,
                    {},
                    { headers: { 'Authorization': `Bearer ${result.accessToken}` } }
                );
                const { token, usuario } = response.data;
                localStorage.setItem('token_bibliotec', token);
                localStorage.setItem('perfil_bibliotec', usuario.permissao);
                localStorage.setItem('nome_usuario_comum', usuario.nome);
                setTokenSessao(token);
                setPerfilUsuario(usuario.permissao);
                setNomeUsuario(usuario.nome);
                registrarLog(`Microsoft: autenticado como ${usuario.nome}`);
            } catch (e: any) {
                registrarLog(`Fallback Azure token: ${e.message}`);
                localStorage.setItem('token_bibliotec', result.accessToken);
                localStorage.setItem('perfil_bibliotec', 'Leitor');
                localStorage.setItem('nome_usuario_comum', nome);
                setTokenSessao(result.accessToken);
                setPerfilUsuario('Leitor');
                setNomeUsuario(nome);
            }
        }).catch((e: any) => {
            localStorage.removeItem('msal_redirect_pending');
            registrarLog(`Erro redirect Microsoft: ${e.message}`);
        });
    }, [instance]); // eslint-disable-line

    // Recarrega dados quando perfil ou filtros mudam
    useEffect(() => {
        if (perfilUsuario) inicializarDados();
    }, [perfilUsuario, settings.isMockMode, apenasDisponiveis, authorSelecionado]); // eslint-disable-line

    const inicializarDados = useCallback(() => {
        if (settings.isMockMode) {
            const savedBooks = localStorage.getItem('bibliotec_livros');
            const savedAuthors = localStorage.getItem('bibliotec_autores');
            const savedLoans = localStorage.getItem('bibliotec_emprestimos');
            if (!savedBooks) localStorage.setItem('bibliotec_livros', JSON.stringify(INITIAL_LIVROS));
            if (!savedAuthors) localStorage.setItem('bibliotec_autores', JSON.stringify(INITIAL_AUTORES));
            if (!savedLoans) localStorage.setItem('bibliotec_emprestimos', JSON.stringify(INITIAL_EMPRESTIMOS));
            let l: Livro[] = savedBooks ? JSON.parse(savedBooks) : INITIAL_LIVROS;
            let a: Autor[] = savedAuthors ? JSON.parse(savedAuthors) : INITIAL_AUTORES;
            let e: Emprestimo[] = savedLoans ? JSON.parse(savedLoans) : INITIAL_EMPRESTIMOS;
            if (authorSelecionado) l = l.filter(livro => livro.autorId === authorSelecionado);
            if (apenasDisponiveis) l = l.filter(livro => livro.quantidade > 0);
            setLivros(l); setAutores(a); setEmprestimos(e); setApiOffline(false);
            registrarLog("Sandbox carregada.");
        } else {
            carregarDadosServico();
        }
    }, [settings.isMockMode, authorSelecionado, apenasDisponiveis]); // eslint-disable-line

    // CRÍTICO: usa getTokenSalvo() para sempre ter o token mais atual
    const carregarDadosServico = useCallback(async () => {
        const token = getTokenSalvo();
        if (!token) return;
        setCarregando(true);
        try {
            const authHeader = { 'Authorization': `Bearer ${token}` };
            const resAutores = await axios.get(`${settings.apiUrl}/autor`);
            setAutores(resAutores.data);
            let urlLivros = `${settings.apiUrl}/livro`;
            if (authorSelecionado) urlLivros = `${settings.apiUrl}/autor/${authorSelecionado}/livros`;
            else if (apenasDisponiveis) urlLivros = `${settings.apiUrl}/livro/disponiveis?disponivel=true`;
            const resLivros = await axios.get(urlLivros);
            setLivros(resLivros.data);
            const resEmprestimos = await axios.get(`${settings.apiUrl}/Emprestimo/meus-emprestimos`, { headers: authHeader });
            setEmprestimos(resEmprestimos.data);
            registrarLog(`Dados carregados: ${resLivros.data.length} livros, ${resEmprestimos.data.length} empréstimos.`);
            setApiOffline(false);
        } catch (e: any) {
            registrarLog(`Erro na API: ${e.message}`);
            setApiOffline(true);
        } finally {
            setCarregando(false);
        }
    }, [settings.apiUrl, authorSelecionado, apenasDisponiveis]); // eslint-disable-line

    const testarConexaoApi = async () => {
        setTestConnectionStatus('testing');
        try {
            await axios.get(`${settings.apiUrl}/autor`);
            setTestConnectionStatus('success'); setApiOffline(false);
            registrarLog("API respondendo.");
        } catch (e: any) {
            setTestConnectionStatus('failed'); setApiOffline(true);
            registrarLog(`API offline: ${e.message}`);
        }
    };

    const handleLoginTradicional = async (e: React.FormEvent) => {
        e.preventDefault();
        setCarregandoLogin(true);
        if (settings.isMockMode) {
            setTimeout(() => {
                const isAdmin = emailForm.includes('admin') || emailForm.includes('colaborador');
                const perfil = isAdmin ? 'Admin' : 'Leitor';
                const nome = isAdmin ? 'Administrador Fiotec' : 'Leitor Conectado';
                const token = isAdmin ? 'sim_token_admin_9921' : 'sim_token_leitor_4821';
                localStorage.setItem('token_bibliotec', token);
                localStorage.setItem('perfil_bibliotec', perfil);
                localStorage.setItem('nome_usuario_comum', nome);
                setTokenSessao(token); setPerfilUsuario(perfil); setNomeUsuario(nome);
                setCarregandoLogin(false);
                registrarLog(`Sandbox: autenticado como ${perfil}.`);
            }, 600);
            return;
        }
        try {
            const response = await axios.post(`${settings.apiUrl}/autenticacao/login`, { email: emailForm, password: senhaForm });
            const { token, usuario } = response.data;
            localStorage.setItem('token_bibliotec', token);
            localStorage.setItem('perfil_bibliotec', usuario.permissao);
            localStorage.setItem('nome_usuario_comum', usuario.nome);
            setTokenSessao(token); setPerfilUsuario(usuario.permissao); setNomeUsuario(usuario.nome);
            setApiOffline(false);
            registrarLog(`API: autenticado como ${usuario.permissao}`);
        } catch (error: any) {
            const msg = error.response?.data?.mensagem || "Credenciais inválidas.";
            alert(`Falha: ${msg}`); registrarLog(`Erro login: ${msg}`);
        } finally { setCarregandoLogin(false); }
    };

    const handleLoginMicrosoft = async () => {
        if (inProgress !== 'none') return;
        if (!instance) { registrarLog("MSAL indisponível."); return; }
        try {
            localStorage.setItem('msal_redirect_pending', 'true');
            await instance.loginRedirect({ ...loginRequest, prompt: "select_account" });
        } catch (e: any) {
            localStorage.removeItem('msal_redirect_pending');
            registrarLog(`Erro redirect: ${e.message}`);
        }
    };

    const handleLogout = () => {
        ['token_bibliotec', 'perfil_bibliotec', 'nome_usuario_comum', 'msal_redirect_pending'].forEach(k => localStorage.removeItem(k));
        setTokenSessao(null); setPerfilUsuario(null); setNomeUsuario(null);
        registrarLog("Sessão encerrada.");
        if (instance && accounts.length > 0) {
            try { instance.logoutRedirect({ postLogoutRedirectUri: window.location.origin }); } catch { }
        }
    };

    const handleSolicitarEmprestimo = async (livro: Livro) => {
        if (livro.quantidade <= 0) { alert("Sem exemplares disponíveis."); return; }
        if (!window.confirm(`Confirmar empréstimo de "${livro.nome}"?`)) return;

        if (settings.isMockMode) {
            const curBooks: Livro[] = JSON.parse(localStorage.getItem('bibliotec_livros') || '[]');
            const curLoans: Emprestimo[] = JSON.parse(localStorage.getItem('bibliotec_emprestimos') || '[]');
            const updatedBooks = curBooks.map(b => b.id === livro.id ? { ...b, quantidade: b.quantidade - 1 } : b);
            const novoEmprestimo: Emprestimo = {
                id: "emp_" + Math.random().toString(36).substr(2, 9),
                livroId: livro.id, tituloLivro: livro.nome, generoLivro: livro.genero,
                dataEmprestimo: new Date().toISOString(), dataDevolucao: null, ativo: true
            };
            localStorage.setItem('bibliotec_livros', JSON.stringify(updatedBooks));
            localStorage.setItem('bibliotec_emprestimos', JSON.stringify([novoEmprestimo, ...curLoans]));
            setLivros(updatedBooks); setEmprestimos([novoEmprestimo, ...curLoans]);
            setLivroDetalhe(null); alert(`Empréstimo de "${livro.nome}" registrado!`); return;
        }

        // CRÍTICO: getTokenSalvo() em vez de tokenSessao (evita closure stale)
        const token = getTokenSalvo();
        if (!token) { alert("Sessão expirada.");; return; }

        try {
            await axios.post(
                `${settings.apiUrl}/Emprestimo`,
                { livroId: livro.id, dataEmprestimo: new Date().toISOString() },
                { headers: { 'Authorization': `Bearer ${token}` } }
            );
            registrarLog("Empréstimo registrado."); setLivroDetalhe(null);
            carregarDadosServico(); alert("Empréstimo solicitado!");
        } catch (error: any) {
            const status = error.response?.status;
            const msg = error.response?.data?.mensagem || error.message;
            if (status === 401) { alert("Sessão expirada."); }
            else alert(`Erro: ${msg}`);
            registrarLog(`Falha empréstimo (${status}): ${msg}`);
        }
    };

    const handleDevolverLivro = async (emprestimo: Emprestimo) => {
        if (!window.confirm("Confirmar devolução?")) return;

        if (settings.isMockMode) {
            const curBooks: Livro[] = JSON.parse(localStorage.getItem('bibliotec_livros') || '[]');
            const curLoans: Emprestimo[] = JSON.parse(localStorage.getItem('bibliotec_emprestimos') || '[]');
            const updatedBooks = curBooks.map(b => b.id === emprestimo.livroId ? { ...b, quantidade: b.quantidade + 1 } : b);
            const updatedLoans = curLoans.map(e => e.id === emprestimo.id ? { ...e, ativo: false, dataDevolucao: new Date().toISOString() } : e);
            localStorage.setItem('bibliotec_livros', JSON.stringify(updatedBooks));
            localStorage.setItem('bibliotec_emprestimos', JSON.stringify(updatedLoans));
            setLivros(updatedBooks); setEmprestimos(updatedLoans);
            registrarLog("Devolução registrada localmente."); return;
        }

        const token = getTokenSalvo();
        if (!token) { handleLogout(); return; }
        try {
            await axios.post(`${settings.apiUrl}/Emprestimo/${emprestimo.id}/devolver`, {}, { headers: { 'Authorization': `Bearer ${token}` } });
            registrarLog("Devolução registrada."); carregarDadosServico();
        } catch (error: any) {
            alert(`Erro: ${error.response?.data?.mensagem || error.message}`);
        }
    };

    const handleCadastrarLivro = async (e: React.FormEvent) => {
        e.preventDefault();
        const autorSelect = autores.find(a => a.id === novoLivro.autorId);
        const limparForm = () => setNovoLivro({ nome: '', autorId: '', genero: '', ano: '', codigo: '', resumo: '', quantidade: 1, cor: '#0082C6' });

        if (settings.isMockMode) {
            const curBooks: Livro[] = JSON.parse(localStorage.getItem('bibliotec_livros') || '[]');
            const nuevo: Livro = {
                id: "book_" + Math.random().toString(36).substr(2, 9),
                nome: novoLivro.nome, autorId: novoLivro.autorId,
                autorNome: autorSelect?.nome || "Desconhecido",
                autor: { id: novoLivro.autorId, nome: autorSelect?.nome || "Desconhecido" },
                genero: novoLivro.genero, ano: parseInt(novoLivro.ano) || new Date().getFullYear(),
                codigo: parseInt(novoLivro.codigo) || 900, resumo: novoLivro.resumo,
                quantidade: novoLivro.quantidade, cor: novoLivro.cor, disponivel: true
            };
            localStorage.setItem('bibliotec_livros', JSON.stringify([nuevo, ...curBooks]));
            setLivros([nuevo, ...curBooks]); limparForm(); alert("Livro cadastrado!"); setAbaAtiva('catalogo'); return;
        }

        const token = getTokenSalvo();
        if (!token) { handleLogout(); return; }
        try {
            await axios.post(`${settings.apiUrl}/livro`,
                { nome: novoLivro.nome, autorId: novoLivro.autorId, genero: novoLivro.genero, ano: parseInt(novoLivro.ano) || 0, codigo: parseInt(novoLivro.codigo) || 0, resumo: novoLivro.resumo, quantidade: novoLivro.quantidade, disponivel: true },
                { headers: { 'Authorization': `Bearer ${token}` } }
            );
            alert("Livro cadastrado!"); limparForm(); setAbaAtiva('catalogo'); carregarDadosServico();
        } catch { alert("Falha ao salvar. Verifique sua permissão."); }
    };

    const handleCadastrarAutor = async () => {
        if (!novoAutorNome.trim()) return;
        if (settings.isMockMode) {
            const curAuthors: Autor[] = JSON.parse(localStorage.getItem('bibliotec_autores') || '[]');
            const nuevo: Autor = { id: "aut_" + Math.random().toString(36).substr(2, 9), nome: novoAutorNome };
            localStorage.setItem('bibliotec_autores', JSON.stringify([...curAuthors, nuevo]));
            setAutores([...curAuthors, nuevo]); setNovoAutorNome(''); setMostrandoAddAutor(false); return;
        }
        const token = getTokenSalvo();
        if (!token) { handleLogout(); return; }
        try {
            await axios.post(`${settings.apiUrl}/autor`, { nome: novoAutorNome }, { headers: { 'Authorization': `Bearer ${token}` } });
            setNovoAutorNome(''); setMostrandoAddAutor(false); carregarDadosServico();
        } catch { alert("Erro ao criar autor."); }
    };

    const handleExcluirLivro = async (livro: Livro) => {
        if (!window.confirm(`Apagar "${livro.nome}"?`)) return;
        if (settings.isMockMode) {
            const curBooks: Livro[] = JSON.parse(localStorage.getItem('bibliotec_livros') || '[]');
            const updated = curBooks.filter(b => b.id !== livro.id);
            localStorage.setItem('bibliotec_livros', JSON.stringify(updated)); setLivros(updated); return;
        }
        const token = getTokenSalvo();
        if (!token) { handleLogout(); return; }
        try {
            await axios.delete(`${settings.apiUrl}/livro/${livro.id}`, { headers: { 'Authorization': `Bearer ${token}` } });
            carregarDadosServico();
        } catch { alert("Erro ao excluir."); }
    };

    const fillCredentials = (type: 'admin' | 'reader') => {
        setSettings(prev => ({ ...prev, isMockMode: true }));
        setEmailForm(type === 'admin' ? 'colaborador@fiotec.com.br' : 'leitor.comum@fiotec.com.br');
        setSenhaForm('123456');
    };

    const livrosFiltrados = livros.filter(livro => {
        if (!livro?.nome) return false;
        const t = busca.toLowerCase();
        return livro.nome.toLowerCase().includes(t) || livro.genero?.toLowerCase().includes(t) || (livro.autorNome || livro.autor?.nome || '').toLowerCase().includes(t);
    });
    const emprestimosAtivosList = emprestimos.filter(e => e.ativo);
    const emprestimosHistoricoList = emprestimos.filter(e => !e.ativo);

    // ================= RENDER =================

    if (!perfilUsuario) {
        return (
            <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-6 font-sans relative overflow-hidden">
                <div className="absolute top-0 left-0 w-96 h-96 bg-[#0082C6]/10 rounded-full filter blur-3xl opacity-60 -translate-x-12 -translate-y-12" />
                <div className="absolute bottom-0 right-0 w-96 h-96 bg-[#30AEE4]/10 rounded-full filter blur-3xl opacity-50 translate-x-12 translate-y-12" />

                <div className="flex items-center gap-3 mb-8 z-10">
                    <div className="w-10 h-10 bg-[#0082C6] rounded-xl flex items-center justify-center shadow-lg">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-5 w-5 text-white">
                            <path d="M4 20h16M6 20v-8l1-1h2l1 1v8M14 20v-8l1-1h2l1 1v8M10 20v-5h4v5M7 11V7l1-1h1l1 1v4M15 11V7l1-1h1l1 1v4" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </div>
                    <div>
                        <span className="text-xl font-black text-[#4E4E4E] block leading-none">Fio<span className="text-[#0082C6]">Tec</span></span>
                        <span className="text-[10px] uppercase font-bold text-slate-400 tracking-widest block mt-1">Plataforma Bibliotec</span>
                    </div>
                </div>

                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
                    className={`w-full bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden z-10 ${mostrarAcessoLocal ? 'max-w-4xl grid grid-cols-1 md:grid-cols-2' : 'max-w-md'}`}>

                    {mostrarAcessoLocal && (
                        <div className="p-8 flex flex-col justify-between border-r border-slate-100">
                            <div>
                                <div className="flex items-center justify-between gap-2 mb-4">
                                    <div className="flex items-center gap-2">
                                        <Lock className="text-[#0082C6]" size={18} />
                                        <h2 className="text-base font-bold text-[#4E4E4E]">Acesso Local</h2>
                                    </div>
                                    <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full uppercase ${settings.isMockMode ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-[#0082C6]/10 text-[#0082C6] border border-[#0082C6]/20'}`}>
                                        {settings.isMockMode ? "Sandbox" : "API .NET"}
                                    </span>
                                </div>
                                <form onSubmit={handleLoginTradicional} className="flex flex-col gap-4">
                                    <div>
                                        <label className="block text-[10px] font-bold text-[#4E4E4E] mb-2 uppercase tracking-wider">E-mail</label>
                                        <input type="email" value={emailForm} onChange={e => setEmailForm(e.target.value)} placeholder="nome@fiotec.fiocruz.br"
                                            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-[#0082C6] outline-none text-sm" required />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-[#4E4E4E] mb-2 uppercase tracking-wider">Senha</label>
                                        <input type="password" value={senhaForm} onChange={e => setSenhaForm(e.target.value)} placeholder="••••••••"
                                            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-[#0082C6] outline-none text-sm" required />
                                    </div>
                                    <button type="submit" disabled={carregandoLogin}
                                        className="w-full bg-[#0082C6] hover:bg-[#0074B2] text-white font-semibold py-3 rounded-xl text-sm mt-2 flex justify-center items-center gap-2 cursor-pointer">
                                        {carregandoLogin ? <><RefreshCw size={16} className="animate-spin" /><span>Autenticando...</span></> : <span>Entrar</span>}
                                    </button>
                                </form>
                            </div>
                            <div className="mt-8 pt-6 border-t border-slate-100 bg-slate-50/50 -mx-8 -mb-8 p-8">
                                <span className="text-[10px] font-bold text-[#4E4E4E] tracking-widest block mb-3 uppercase">Acesso de Teste</span>
                                <div className="grid grid-cols-2 gap-3">
                                    <button onClick={() => fillCredentials('reader')} className="border border-[#0082C6]/20 bg-[#0082C6]/5 hover:bg-[#0082C6]/10 text-[#0082C6] text-xs py-2 px-3 rounded-xl font-semibold cursor-pointer">✓ Leitor</button>
                                    <button onClick={() => fillCredentials('admin')} className="border border-[#9E519F]/20 bg-[#9E519F]/5 hover:bg-[#9E519F]/10 text-[#9E519F] text-xs py-2 px-3 rounded-xl font-semibold cursor-pointer">✦ Admin</button>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className={`${mostrarAcessoLocal ? 'bg-slate-50' : 'bg-white'} p-8 flex flex-col justify-between text-center items-center min-h-[380px]`}>
                        <div className="my-auto py-8">
                            <div className="w-14 h-14 bg-white text-[#0082C6] rounded-2xl flex items-center justify-center mx-auto mb-6 border border-slate-200 shadow-md">
                                <Globe size={26} />
                            </div>
                            <h2 className="text-xl font-bold text-[#4E4E4E] mb-2">Acesso Corporativo</h2>
                            <p className="text-sm text-slate-400 max-w-xs mx-auto mb-6 leading-relaxed">Utilize suas credenciais Microsoft Office 365.</p>
                            <button onClick={handleLoginMicrosoft}
                                className="w-full bg-slate-900 hover:bg-black text-white font-semibold py-3.5 px-6 rounded-xl text-sm flex justify-center items-center gap-3 cursor-pointer">
                                <span className="bg-white/10 p-1 rounded">
                                    <svg width="18" height="18" viewBox="0 0 23 23">
                                        <path fill="#f3f2f1" d="M0 0h23v23H0z" /><path fill="#f25022" d="M1 1h10v10H1z" />
                                        <path fill="#7fba00" d="M12 1h10v10H12z" /><path fill="#00a4ef" d="M1 12h10v10H1z" />
                                        <path fill="#ffb900" d="M12 12h10v10H12z" />
                                    </svg>
                                </span>
                                Conectar via Microsoft
                            </button>
                        </div>
                        <div className="border-t border-slate-200/60 py-4 w-full text-xs text-slate-400">Autenticação via Active Directory</div>
                    </div>
                </motion.div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-screen w-full bg-slate-50 text-slate-700 font-sans overflow-hidden">
            <header className="h-16 flex items-center justify-between px-8 bg-white border-b border-slate-200 shrink-0 z-10">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-[#0082C6] rounded-lg flex items-center justify-center">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-5 w-5 text-white">
                            <path d="M4 20h16M6 20v-8l1-1h2l1 1v8M14 20v-8l1-1h2l1 1v8M10 20v-5h4v5M7 11V7l1-1h1l1 1v4M15 11V7l1-1h1l1 1v4" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </div>
                    <div>
                        <span className="text-base font-black text-[#4E4E4E] block leading-none">Fio<span className="text-[#0082C6]">Tec</span></span>
                        <span className="text-[9px] uppercase font-bold text-slate-400">Bibliotec</span>
                    </div>
                </div>
                <div className="relative">
                    <input type="text" placeholder="Pesquisar livros, autores..." value={busca}
                        onChange={e => { setBusca(e.target.value); if (abaAtiva !== 'catalogo' && e.target.value) setAbaAtiva('catalogo'); }}
                        className="w-80 h-10 pl-10 pr-4 rounded-full bg-slate-50 border border-slate-200 text-sm focus:border-[#0082C6] outline-none" />
                    <Search className="h-4 w-4 absolute left-3.5 top-3 text-slate-400" />
                </div>
                <div className="flex items-center gap-3 border-l border-slate-200 pl-6">
                    <div className="text-right">
                        <p className="text-xs font-semibold text-slate-700 leading-tight">{nomeUsuario}</p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase">{perfilUsuario}</p>
                    </div>
                    <div className="w-9 h-9 bg-[#0082C6]/10 text-[#0082C6] font-bold rounded-full border border-slate-200 flex items-center justify-center text-xs">
                        {(nomeUsuario || 'US').substring(0, 2).toUpperCase()}
                    </div>
                </div>
            </header>

            <div className="flex flex-1 overflow-hidden">
                <aside className="w-64 bg-white border-r border-slate-200 flex flex-col justify-between shrink-0">
                    <nav className="flex-1 py-6 flex flex-col">
                        <p className="px-6 text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Menu</p>
                        {([
                            { key: 'catalogo', label: 'Acervo Geral', icon: <BookOpen className="w-4 h-4 text-slate-400" /> },
                            { key: 'pendentes', label: 'Livros Pendentes', icon: <Clock className="w-4 h-4 text-slate-400" />, badge: emprestimosAtivosList.length },
                            { key: 'historico', label: 'Histórico', icon: <CheckCircle className="w-4 h-4 text-slate-400" /> },
                        ] as const).map(item => (
                            <button key={item.key} onClick={() => setAbaAtiva(item.key as any)}
                                className={`flex items-center gap-3 px-6 py-3 text-sm font-semibold transition text-left cursor-pointer relative ${abaAtiva === item.key ? 'bg-[#0082C6]/5 text-[#0082C6] border-r-4 border-[#0082C6]' : 'text-slate-600 hover:bg-slate-50'}`}>
                                {item.icon}{item.label}
                                {'badge' in item && item.badge > 0 && (
                                    <span className="absolute right-6 bg-[#F6851F] text-white text-[9px] w-5 h-5 rounded-full flex items-center justify-center font-bold border-2 border-white">{item.badge}</span>
                                )}
                            </button>
                        ))}
                        {(perfilUsuario === 'Admin' || perfilUsuario === 'Colaborador') && (
                            <button onClick={() => setAbaAtiva('admin')}
                                className={`flex items-center gap-3 px-6 py-3 text-sm font-semibold cursor-pointer ${abaAtiva === 'admin' ? 'bg-[#9E519F]/5 text-[#9E519F] border-r-4 border-[#9E519F]' : 'text-slate-600 hover:bg-slate-50'}`}>
                                <Plus className="w-4 h-4 text-slate-400" />Gestão Admin
                            </button>
                        )}
                        <p className="px-6 text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-8 mb-4">Ações</p>
                        <button onClick={() => setShowSettingsSidebar(true)} className="flex items-center gap-3 px-6 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer">
                            <Sliders className="w-4 h-4 text-slate-400" />Configurar Conexão
                        </button>
                        <button onClick={handleLogout} className="flex items-center gap-3 px-6 py-3 text-sm font-semibold text-red-600 hover:bg-red-50/50 cursor-pointer mt-auto">
                            <LogOut className="w-4 h-4 text-red-400" />Encerrar Sessão
                        </button>
                    </nav>
                    <div className="p-6">
                        <div className="bg-[#0082C6]/5 border border-[#0082C6]/10 rounded-xl p-4">
                            <div className="flex items-center gap-1.5 text-xs font-semibold text-[#0082C6] mb-1"><Database size={13} /><span>Base de Dados</span></div>
                            <p className="text-[10px] text-slate-400 mb-3 leading-tight">{settings.isMockMode ? "Sandbox local ativa." : "Sincronizado com backend."}</p>
                            <button onClick={() => setShowSettingsSidebar(true)} className="w-full py-2 bg-[#0082C6] text-white text-[10px] font-bold uppercase rounded-lg hover:bg-[#0074B2] cursor-pointer">Configurar</button>
                        </div>
                    </div>
                </aside>

                <main className="flex-1 p-8 flex flex-col gap-6 overflow-y-auto">
                    {apiOffline && !settings.isMockMode && (
                        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
                            className="bg-[#F04A42]/10 border border-[#F04A42]/30 rounded-xl p-4 flex justify-between items-center gap-3 shrink-0">
                            <div className="flex gap-3 items-center">
                                <AlertTriangle className="text-[#F04A42] shrink-0" size={20} />
                                <p className="text-xs text-slate-600">API offline em <code className="font-mono font-bold">{settings.apiUrl}</code></p>
                            </div>
                            <button onClick={() => setSettings({ ...settings, isMockMode: true })} className="py-2 px-3 bg-[#0082C6] text-white text-[11px] font-bold rounded-lg cursor-pointer shrink-0">Ativar Sandbox</button>
                        </motion.div>
                    )}

                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 shrink-0">
                        {[
                            { label: 'Títulos', value: livros.length, tag: 'Acervo', color: 'text-[#0082C6] bg-[#0082C6]/10' },
                            { label: 'Empréstimos Ativos', value: emprestimosAtivosList.length, tag: emprestimosAtivosList.length > 0 ? 'Pendente' : 'Em dia', color: emprestimosAtivosList.length > 0 ? 'text-amber-600 bg-amber-50' : 'text-emerald-600 bg-emerald-50' },
                            { label: 'Devoluções', value: emprestimosHistoricoList.length, tag: 'Histórico', color: 'text-emerald-500 bg-emerald-50' },
                            { label: 'Autores', value: autores.length, tag: 'Cadastrados', color: 'text-purple-500 bg-purple-50' },
                        ].map(card => (
                            <div key={card.label} className="bg-white p-5 rounded-xl border border-slate-200 flex flex-col justify-between">
                                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">{card.label}</p>
                                <div className="flex items-end justify-between">
                                    <h3 className="text-2xl font-bold text-slate-800">{card.value}</h3>
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${card.color}`}>{card.tag}</span>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="flex-1 bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col min-h-0">
                        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
                            <h2 className="text-sm font-bold text-slate-800 uppercase">
                                {abaAtiva === 'catalogo' && "Acervo Geral"}{abaAtiva === 'pendentes' && "Livros Pendentes"}
                                {abaAtiva === 'historico' && "Histórico de Devoluções"}{abaAtiva === 'admin' && "Gestão Administrativa"}
                            </h2>
                            <span className="text-[11px] text-slate-400 font-mono">FIOTEC CORP</span>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6 min-h-0">
                            <AnimatePresence mode="wait">

                                {abaAtiva === 'catalogo' && (
                                    <motion.div key="catalogo" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex flex-col gap-6">
                                        <div className="bg-white p-5 rounded-2xl border border-gray-200 flex flex-col md:flex-row gap-4 items-center">
                                            <div className="relative flex-1 w-full">
                                                <Search className="absolute left-3.5 top-3 text-gray-400" size={18} />
                                                <input type="text" value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar título, autor ou gênero..."
                                                    className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-gray-300 focus:border-[#0082C6] outline-none text-sm" />
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <select value={authorSelecionado} onChange={e => setAuthorSelecionado(e.target.value)}
                                                    className="px-4 py-2.5 rounded-xl border border-gray-300 focus:border-[#0082C6] outline-none text-sm bg-white">
                                                    <option value="">Todos os Autores</option>
                                                    {autores.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
                                                </select>
                                                <label className="flex items-center gap-2 cursor-pointer text-sm font-semibold text-gray-600">
                                                    <input type="checkbox" checked={apenasDisponiveis} onChange={e => setApenasDisponiveis(e.target.checked)} className="rounded text-[#0082C6]" />
                                                    Disponíveis
                                                </label>
                                            </div>
                                        </div>

                                        {carregando ? (
                                            <div className="py-24 text-center flex flex-col items-center gap-3">
                                                <RefreshCw className="animate-spin text-[#0082C6]" size={32} />
                                                <p className="text-gray-400 text-sm">Carregando...</p>
                                            </div>
                                        ) : livrosFiltrados.length === 0 ? (
                                            <div className="py-20 text-center border border-gray-200 rounded-2xl p-8">
                                                <Info className="mx-auto text-gray-300 mb-3" size={40} />
                                                <h3 className="text-lg font-bold text-gray-700">Nenhum exemplar encontrado</h3>
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                                {livrosFiltrados.map(livro => (
                                                    <motion.div key={livro.id} onClick={() => setLivroDetalhe(livro)} whileHover={{ y: -4 }}
                                                        className="bg-white rounded-2xl border border-gray-200 overflow-hidden cursor-pointer flex flex-col">
                                                        <div style={{ backgroundColor: livro.cor || '#0082C6' }} className="h-2 w-full" />
                                                        <div className="p-5 flex flex-col gap-3 flex-1">
                                                            <div className="flex justify-between items-start gap-2">
                                                                <span className="text-[10px] font-bold uppercase text-gray-400 bg-gray-50 border border-gray-100 px-2 py-0.5 rounded">{livro.genero}</span>
                                                                <span className="text-[10px] font-mono px-2 py-0.5 rounded text-white" style={{ backgroundColor: livro.cor || '#4E4E4E' }}>CDD {livro.codigo}</span>
                                                            </div>
                                                            <h3 className="font-extrabold text-base text-gray-800 line-clamp-2 leading-tight">{livro.nome}</h3>
                                                            <p className="text-xs text-gray-400">Autor: <span className="text-[#0082C6] font-bold">{livro.autorNome || livro.autor?.nome}</span></p>
                                                            <p className="text-xs text-gray-400 line-clamp-3 leading-relaxed flex-1">{livro.resumo || "Sem resumo."}</p>
                                                            <div className="pt-3 border-t border-gray-100 flex justify-between items-center">
                                                                <div>
                                                                    <span className={`text-[10px] font-extrabold ${livro.quantidade > 0 ? 'text-emerald-500' : 'text-red-500'}`}>{livro.quantidade > 0 ? '• DISPONÍVEL' : '• ESGOTADO'}</span>
                                                                    <p className="text-[10px] text-gray-400">Estoque: {livro.quantidade} un</p>
                                                                </div>
                                                                <span className="text-xs text-[#0082C6] font-bold">Ver →</span>
                                                            </div>
                                                        </div>
                                                    </motion.div>
                                                ))}
                                            </div>
                                        )}
                                    </motion.div>
                                )}

                                {abaAtiva === 'pendentes' && (
                                    <motion.div key="pendentes" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                                        className="bg-white rounded-2xl border border-gray-200 p-6">
                                        <div className="flex items-center gap-2 mb-6"><Clock className="text-[#0082C6]" /><h2 className="text-lg font-bold text-gray-800">Pendentes de Devolução</h2></div>
                                        {emprestimosAtivosList.length === 0 ? (
                                            <div className="text-center py-16">
                                                <Check className="mx-auto text-emerald-500 bg-emerald-50 p-2.5 rounded-full border border-emerald-100 mb-3" size={44} />
                                                <h3 className="text-sm font-bold text-gray-700">Tudo em dia!</h3>
                                            </div>
                                        ) : (
                                            <table className="w-full text-left text-sm">
                                                <thead><tr className="border-b border-gray-200 text-xs text-gray-400 uppercase font-bold">
                                                    <th className="py-3 px-4">Título</th><th className="py-3 px-4">Gênero</th>
                                                    <th className="py-3 px-4">Retirada</th><th className="py-3 px-4">Status</th><th className="py-3 px-4 text-right">Ação</th>
                                                </tr></thead>
                                                <tbody>
                                                    {emprestimosAtivosList.map(emp => (
                                                        <tr key={emp.id} className="border-b border-gray-100 hover:bg-gray-50/50">
                                                            <td className="py-3 px-4 font-bold text-gray-800">{emp.tituloLivro}</td>
                                                            <td className="py-3 px-4 text-gray-400">{emp.generoLivro}</td>
                                                            <td className="py-3 px-4 text-gray-500">{new Date(emp.dataEmprestimo).toLocaleDateString('pt-BR')}</td>
                                                            <td className="py-3 px-4"><span className="bg-amber-50 text-amber-600 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-100 uppercase">Pendente</span></td>
                                                            <td className="py-3 px-4 text-right">
                                                                <button onClick={() => handleDevolverLivro(emp)} className="bg-emerald-50 hover:bg-emerald-100 text-emerald-600 border border-emerald-100 font-bold text-xs px-3 py-1.5 rounded-lg cursor-pointer">Devolver</button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        )}
                                    </motion.div>
                                )}

                                {abaAtiva === 'historico' && (
                                    <motion.div key="historico" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                                        className="bg-white rounded-2xl border border-gray-200 p-6">
                                        <div className="flex items-center gap-2 mb-6"><CheckCircle className="text-[#0082C6]" /><h2 className="text-lg font-bold text-gray-800">Histórico de Devoluções</h2></div>
                                        {emprestimosHistoricoList.length === 0 ? (
                                            <div className="text-center py-16"><FileText className="mx-auto text-gray-300 mb-3" size={32} /><h3 className="text-sm font-bold text-gray-500">Nenhuma devolução.</h3></div>
                                        ) : (
                                            <table className="w-full text-left text-sm">
                                                <thead><tr className="border-b border-gray-200 text-xs text-gray-400 uppercase font-bold">
                                                    <th className="py-3 px-4">Título</th><th className="py-3 px-4">Gênero</th>
                                                    <th className="py-3 px-4">Retirada</th><th className="py-3 px-4">Devolução</th><th className="py-3 px-4">Status</th>
                                                </tr></thead>
                                                <tbody>
                                                    {emprestimosHistoricoList.map(emp => (
                                                        <tr key={emp.id} className="border-b border-gray-100 hover:bg-gray-50/50">
                                                            <td className="py-3 px-4 font-bold text-gray-800">{emp.tituloLivro}</td>
                                                            <td className="py-3 px-4 text-gray-400">{emp.generoLivro}</td>
                                                            <td className="py-3 px-4 text-gray-500">{new Date(emp.dataEmprestimo).toLocaleDateString('pt-BR')}</td>
                                                            <td className="py-3 px-4 text-emerald-600">{emp.dataDevolucao ? new Date(emp.dataDevolucao).toLocaleDateString('pt-BR') : '—'}</td>
                                                            <td className="py-3 px-4"><span className="bg-emerald-50 text-emerald-600 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-100 uppercase">Devolvido</span></td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        )}
                                    </motion.div>
                                )}

                                {abaAtiva === 'admin' && (perfilUsuario === 'Admin' || perfilUsuario === 'Colaborador') && (
                                    <motion.div key="admin" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                        <div className="bg-white rounded-2xl border border-gray-200 p-6 md:col-span-2">
                                            <div className="flex justify-between items-center mb-6">
                                                <h2 className="text-base font-extrabold text-[#9E519F]">Cadastrar Novo Livro</h2>
                                                <span className="text-[10px] bg-purple-50 text-purple-600 border border-purple-100 font-bold px-2 py-0.5 rounded uppercase">Admin</span>
                                            </div>
                                            <form onSubmit={handleCadastrarLivro} className="flex flex-col gap-4">
                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                    <div className="md:col-span-2">
                                                        <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Título *</label>
                                                        <input type="text" value={novoLivro.nome} onChange={e => setNovoLivro({ ...novoLivro, nome: e.target.value })} placeholder="Ex: Grande Sertão: Veredas"
                                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-[#9E519F] outline-none" required />
                                                    </div>
                                                    <div>
                                                        <div className="flex justify-between items-center mb-1">
                                                            <label className="block text-xs font-bold text-gray-400 uppercase">Autor *</label>
                                                            <button type="button" onClick={() => setMostrandoAddAutor(!mostrandoAddAutor)} className="text-[11px] font-bold text-purple-600 hover:underline cursor-pointer">
                                                                {mostrandoAddAutor ? "Fechar" : "+ Criar"}
                                                            </button>
                                                        </div>
                                                        {!mostrandoAddAutor ? (
                                                            <select value={novoLivro.autorId} onChange={e => setNovoLivro({ ...novoLivro, autorId: e.target.value })}
                                                                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-xs bg-white focus:border-[#9E519F] outline-none" required>
                                                                <option value="">Selecione...</option>
                                                                {autores.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
                                                            </select>
                                                        ) : (
                                                            <div className="flex gap-1.5">
                                                                <input type="text" value={novoAutorNome} onChange={e => setNovoAutorNome(e.target.value)} placeholder="Nome"
                                                                    className="flex-1 px-2.5 py-2.5 border border-purple-300 rounded-lg text-xs outline-none" />
                                                                <button type="button" onClick={handleCadastrarAutor} className="bg-[#9E519F] text-white p-2.5 rounded-lg cursor-pointer"><Check size={14} /></button>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                                    <div><label className="block text-xs font-bold text-gray-400 uppercase mb-1">Gênero *</label>
                                                        <input type="text" value={novoLivro.genero} onChange={e => setNovoLivro({ ...novoLivro, genero: e.target.value })} placeholder="Ex: Romance"
                                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-[#9E519F] outline-none" required /></div>
                                                    <div><label className="block text-xs font-bold text-gray-400 uppercase mb-1">Ano *</label>
                                                        <input type="number" value={novoLivro.ano} onChange={e => setNovoLivro({ ...novoLivro, ano: e.target.value })} placeholder="Ex: 1956"
                                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-[#9E519F] outline-none" required /></div>
                                                    <div><label className="block text-xs font-bold text-gray-400 uppercase mb-1">CDD *</label>
                                                        <input type="number" value={novoLivro.codigo} onChange={e => setNovoLivro({ ...novoLivro, codigo: e.target.value })} placeholder="Ex: 869"
                                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-[#9E519F] outline-none" required /></div>
                                                    <div><label className="block text-xs font-bold text-gray-400 uppercase mb-1">Qtd *</label>
                                                        <input type="number" min="1" value={novoLivro.quantidade} onChange={e => setNovoLivro({ ...novoLivro, quantidade: parseInt(e.target.value) || 1 })}
                                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-[#9E519F] outline-none" required /></div>
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Cor da Lombada</label>
                                                    <div className="flex gap-2.5 items-center bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                                                        {['#0082C6', '#9E519F', '#70BF4A', '#F04A42', '#F1BD36', '#1f2937'].map(color => (
                                                            <button key={color} type="button" onClick={() => setNovoLivro({ ...novoLivro, cor: color })} style={{ backgroundColor: color }}
                                                                className={`w-7 h-7 rounded-full border-2 flex items-center justify-center cursor-pointer ${novoLivro.cor === color ? 'border-white ring-2 ring-purple-600 scale-110' : 'border-transparent'}`}>
                                                                {novoLivro.cor === color && <Check size={12} className="text-white" />}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Resumo *</label>
                                                    <textarea value={novoLivro.resumo} onChange={e => setNovoLivro({ ...novoLivro, resumo: e.target.value })} placeholder="Resumo para catálogo..."
                                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm min-h-[80px] focus:border-[#9E519F] outline-none" required />
                                                </div>
                                                <button type="submit" className="w-full bg-[#9E519F] hover:bg-[#864387] text-white font-bold py-3 rounded-xl text-sm flex justify-center items-center gap-2 cursor-pointer">
                                                    <Check size={16} />Salvar no Banco
                                                </button>
                                            </form>
                                        </div>

                                        <div className="flex flex-col gap-6">
                                            <div className="bg-gradient-to-br from-[#0082C6] to-[#0293AF] text-white p-6 rounded-2xl relative overflow-hidden">
                                                <div className="absolute right-0 top-0 text-white/5 translate-x-4 -translate-y-4"><Database size={120} /></div>
                                                <h3 className="font-extrabold text-base flex items-center gap-2 mb-2"><Sparkles size={16} className="text-[#F1BD36]" />MySQL Integrado</h3>
                                                <div className="text-[10px] font-mono bg-black/30 p-2.5 rounded-lg border border-white/20 flex flex-col gap-1">
                                                    <span>► DB: db_bibliotec</span><span>► ENGINE: InnoDB</span><span>► STATE: ONLINE</span>
                                                </div>
                                            </div>
                                            <div className="bg-white rounded-2xl border border-gray-200 p-5 flex-1">
                                                <h3 className="text-xs font-bold text-gray-500 mb-4 uppercase tracking-wider">Exclusão Rápida</h3>
                                                <div className="flex flex-col gap-2 max-h-[280px] overflow-y-auto">
                                                    {livros.map(l => (
                                                        <div key={l.id} className="flex justify-between items-center gap-2 px-3 py-2 border border-gray-100 rounded-lg text-xs hover:bg-gray-50">
                                                            <div className="flex-1 min-w-0">
                                                                <p className="font-bold text-gray-800 truncate">{l.nome}</p>
                                                                <p className="text-gray-400 truncate">{l.autorNome || l.autor?.nome}</p>
                                                            </div>
                                                            <button onClick={() => handleExcluirLivro(l)} className="p-1.5 text-red-500 hover:bg-red-50 rounded cursor-pointer"><Trash2 size={14} /></button>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </motion.div>
                                )}

                            </AnimatePresence>
                        </div>
                    </div>
                </main>
            </div>

            <AnimatePresence>
                {livroDetalhe && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-40">
                        <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
                            className="bg-white rounded-2xl overflow-hidden shadow-2xl max-w-lg w-full border border-gray-200 flex flex-col">
                            <div style={{ backgroundColor: livroDetalhe.cor || '#0082C6' }} className="h-3 w-full" />
                            <div className="p-6 md:p-8 flex flex-col gap-4">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <span className="text-[10px] font-bold text-gray-400 uppercase bg-gray-100 px-2 py-0.5 rounded border border-gray-200">{livroDetalhe.genero}</span>
                                        <p className="text-xs text-gray-400 font-mono mt-1">CDD {livroDetalhe.codigo}</p>
                                    </div>
                                    <button onClick={() => setLivroDetalhe(null)} className="text-gray-400 hover:text-gray-600 font-bold p-1 cursor-pointer">✕</button>
                                </div>
                                <div>
                                    <h3 className="font-black text-xl text-gray-800">{livroDetalhe.nome}</h3>
                                    <p className="text-sm text-gray-500 mt-1">Autor: <span className="text-[#0082C6] font-bold">{livroDetalhe.autorNome || livroDetalhe.autor?.nome}</span></p>
                                </div>
                                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                                    <span className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Resumo</span>
                                    <p className="text-xs text-gray-500 leading-relaxed max-h-32 overflow-y-auto">{livroDetalhe.resumo || "Sem resumo."}</p>
                                </div>
                                <div className="grid grid-cols-2 gap-4 bg-gray-50/50 p-3.5 rounded-xl text-xs text-gray-500 font-semibold">
                                    <div className="flex items-center gap-1.5"><Calendar size={13} className="text-gray-400" /><span>Ano: {livroDetalhe.ano}</span></div>
                                    <div className="flex items-center gap-1.5"><Layers size={13} className="text-gray-400" /><span>Estoque: {livroDetalhe.quantidade} un</span></div>
                                </div>
                                <div className="pt-4 border-t border-gray-100 flex gap-3">
                                    <button onClick={() => setLivroDetalhe(null)} className="flex-1 bg-gray-100 hover:bg-gray-200 font-bold py-2.5 rounded-xl text-xs text-gray-600 cursor-pointer">Fechar</button>
                                    <button onClick={() => handleSolicitarEmprestimo(livroDetalhe)} disabled={livroDetalhe.quantidade <= 0}
                                        className={`flex-1 font-bold py-2.5 rounded-xl text-xs text-white cursor-pointer ${livroDetalhe.quantidade > 0 ? 'bg-[#0082C6] hover:bg-[#0071ad]' : 'bg-gray-300 cursor-not-allowed'}`}>
                                        {livroDetalhe.quantidade > 0 ? 'Confirmar Empréstimo' : 'Esgotado'}
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {showSettingsSidebar && (
                    <>
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            onClick={() => setShowSettingsSidebar(false)} className="fixed inset-0 bg-black/50 z-40" />
                        <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 25 }}
                            className="fixed right-0 top-0 bottom-0 max-w-md w-full bg-[#16171d] text-white shadow-2xl z-50 p-6 flex flex-col justify-between border-l border-gray-800">
                            <div className="flex flex-col gap-6">
                                <div className="flex justify-between items-center pb-4 border-b border-gray-800">
                                    <div className="flex items-center gap-2"><Sliders className="text-[#0082C6]" size={18} /><h2 className="text-base font-bold">Configuração</h2></div>
                                    <button onClick={() => setShowSettingsSidebar(false)} className="text-gray-400 hover:text-white font-bold cursor-pointer">✕</button>
                                </div>
                                <div className="flex flex-col gap-3">
                                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Fonte de Dados</h3>
                                    <div className="grid grid-cols-2 gap-2 bg-black/40 p-1 rounded-xl border border-gray-800">
                                        <button onClick={() => setSettings({ ...settings, isMockMode: true })}
                                            className={`py-2 px-3 text-xs font-bold rounded-lg cursor-pointer ${settings.isMockMode ? 'bg-[#0082C6] text-white' : 'text-gray-400 hover:text-white'}`}>Demonstração</button>
                                        <button onClick={() => setSettings({ ...settings, isMockMode: false })}
                                            className={`py-2 px-3 text-xs font-bold rounded-lg cursor-pointer ${!settings.isMockMode ? 'bg-[#0082C6] text-white' : 'text-gray-400 hover:text-white'}`}>API .NET</button>
                                    </div>
                                </div>
                                <div className="flex flex-col gap-2">
                                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">URL do Backend</label>
                                    <div className="flex gap-2">
                                        <input type="url" value={settings.apiUrl} onChange={e => setSettings({ ...settings, apiUrl: e.target.value })} disabled={settings.isMockMode}
                                            className="flex-1 bg-black/40 border border-gray-800 focus:border-[#0082C6] rounded-xl px-3.5 py-2.5 text-xs text-white font-mono outline-none disabled:opacity-40" />
                                        <button onClick={testarConexaoApi} disabled={settings.isMockMode || testConnectionStatus === 'testing'}
                                            className="px-3 py-2 bg-gray-800 hover:bg-gray-700 font-bold rounded-xl text-xs text-gray-300 disabled:opacity-30 cursor-pointer">
                                            {testConnectionStatus === 'testing' ? 'Testando...' : 'Testar'}
                                        </button>
                                    </div>
                                    {testConnectionStatus === 'success' && <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20 w-max">● API ONLINE</span>}
                                    {testConnectionStatus === 'failed' && <span className="text-[10px] font-mono font-bold text-red-400 bg-red-500/10 px-3 py-1.5 rounded-lg border border-red-500/20 w-max">● API OFFLINE</span>}
                                </div>
                                <div className="flex flex-col gap-2 flex-1">
                                    <div className="flex justify-between items-center">
                                        <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Terminal de Logs</span>
                                        <button onClick={() => setLogs([])} className="text-[10px] text-gray-500 hover:text-white cursor-pointer">Limpar</button>
                                    </div>
                                    <div className="bg-black border border-gray-800 p-3.5 rounded-xl font-mono text-[10px] h-48 overflow-y-auto text-emerald-400 flex flex-col gap-1.5">
                                        {logs.length === 0 ? <span className="text-gray-600">Aguardando eventos...</span> : logs.map((log, i) => <div key={i} className="truncate">{log}</div>)}
                                    </div>
                                </div>
                            </div>
                            <div className="border-t border-gray-800 pt-4 mt-6 text-[10px] text-gray-500 text-center">Bibliotec Fiotec v3.1 • MySQL integrado</div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            <footer className="bg-white border-t border-gray-200 py-4 px-10 text-xs text-gray-400 font-semibold flex justify-between items-center shrink-0">
                <p className="flex items-center gap-1.5">
                    <span>Bibliotec Fiotec © {new Date().getFullYear()}</span><span>•</span>
                    <span className="bg-blue-50 text-[#0082C6] px-2 py-0.5 rounded text-[10px]">Portal de Leitura</span>
                </p>
                <span className="font-mono text-[11px] hidden sm:inline">MySQL Sincronizado</span>
            </footer>
        </div>
    );
}

function BookMarkdownIcon() {
    return <div className="p-1 px-2 rounded bg-purple-50 border border-purple-100 text-purple-700"><Database size={14} /></div>;
}