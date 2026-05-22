import React, { useState, useEffect } from 'react';
import { useMsal } from '@azure/msal-react';
import { InteractionStatus } from '@azure/msal-browser';
import { loginRequest } from './authConfig';
import axios from 'axios';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BookOpen, 
  User, 
  LogOut, 
  Search, 
  Plus, 
  Trash2, 
  RefreshCw, 
  Sliders, 
  Settings, 
  FileText, 
  Clock, 
  CheckCircle, 
  AlertTriangle, 
  Tag, 
  Home, 
  Users, 
  Info, 
  Check, 
  HelpCircle,
  Database,
  Globe,
  Lock,
  Calendar,
  Layers,
  Sparkles,
  BookMarked
} from 'lucide-react';

import { Autor, Livro, Emprestimo, AppSettings } from './types';
import { INITIAL_AUTORES, INITIAL_LIVROS, INITIAL_EMPRESTIMOS } from './data';

export default function App() {
  // --- SEGURANÇA MSAL CONTRA ERROS DE IFRAME ---
  let msalContext: any = null;
  try {
    msalContext = useMsal();
  } catch (e) {
    console.warn("Contexto MSAL indisponível. Operando somente no modo local.", e);
  }

  const accounts = msalContext ? msalContext.accounts : [];
  const instance = msalContext ? msalContext.instance : null;
  const inProgress = msalContext ? msalContext.inProgress : 'none';

  // --- CONFIGURAÇÃO DA API & EMULAÇÃO ---
  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem('bibliotec_settings');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { /* ignore */ }
    }
    return { isMockMode: true, apiUrl: "https://localhost:7172/api" };
  });

  const [testConnectionStatus, setTestConnectionStatus] = useState<'idle' | 'testing' | 'success' | 'failed'>('idle');
  const [showSettingsSidebar, setShowSettingsSidebar] = useState(false);

  // --- ESTADOS DO BANCO DE DADOS (LOCAL / RESTRITO) ---
  const [livros, setLivros] = useState<Livro[]>([]);
  const [autores, setAutores] = useState<Autor[]>([]);
  const [emprestimos, setEmprestimos] = useState<Emprestimo[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [apiOffline, setApiOffline] = useState(false);
  const [abaAtiva, setAbaAtiva] = useState<'catalogo' | 'pendentes' | 'historico' | 'admin'>('catalogo');

  // --- ESTADOS DE LOGIN E SESSÃO ---
  const [perfilUsuario, setPerfilUsuario] = useState<string | null>(null);
  const [nomeUsuario, setNomeUsuario] = useState<string | null>(null);
  const [tokenSessao, setTokenSessao] = useState<string | null>(null);

  // --- DETECTOR DE URL RESTRITO ---
  const [mostrarAcessoLocal, setMostrarAcessoLocal] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('admin') === 'true' || window.location.hash === '#admin';
  });

  useEffect(() => {
    const handleUrlChange = () => {
      const params = new URLSearchParams(window.location.search);
      setMostrarAcessoLocal(params.get('admin') === 'true' || window.location.hash === '#admin');
    };
    window.addEventListener('hashchange', handleUrlChange);
    window.addEventListener('popstate', handleUrlChange);
    return () => {
      window.removeEventListener('hashchange', handleUrlChange);
      window.removeEventListener('popstate', handleUrlChange);
    };
  }, []);

  // --- ESTADOS DO FORMULÁRIO DE LOGIN LOCAL ---
  const [emailForm, setEmailForm] = useState('');
  const [senhaForm, setSenhaForm] = useState('');
  const [carregandoLogin, setCarregandoLogin] = useState(false);

  // --- FILTROS E BUSCA ---
  const [busca, setBusca] = useState('');
  const [apenasDisponiveis, setApenasDisponiveis] = useState(false);
  const [authorSelecionado, setAuthorSelecionado] = useState('');

  // --- ESTADO DETALHE DO LIVRO (MODAL) ---
  const [livroDetalhe, setLivroDetalhe] = useState<Livro | null>(null);

  // --- FORMULÁRIO DE CADASTRO DE LIVRO ---
  const [novoLivro, setNovoLivro] = useState({
    nome: '',
    autorId: '',
    genero: '',
    ano: '',
    codigo: '',
    resumo: '',
    quantidade: 1,
    cor: '#0082C6'
  });

  // --- FORMULÁRIO DE CADASTRO DE AUTOR ---
  const [novoAutorNome, setNovoAutorNome] = useState('');
  const [mostrandoAddAutor, setMostrandoAddAutor] = useState(false);

  // --- REGISTRO DE LOGS DE EVENTO ---
  const [logs, setLogs] = useState<string[]>([]);

  const registrarLog = (msg: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [`[${timestamp}] ${msg}`, ...prev.slice(0, 20)]);
  };

  // Salva configurações
  useEffect(() => {
    localStorage.setItem('bibliotec_settings', JSON.stringify(settings));
  }, [settings]);

  // --- INICIALIZAÇÃO DE CRONOLOGIAS ---
  useEffect(() => {
    const token = localStorage.getItem('token_bibliotec');
    const perfil = localStorage.getItem('perfil_bibliotec');
    const nome = localStorage.getItem('nome_usuario_comum');
    
    if (token && perfil) {
      setTokenSessao(token);
      setPerfilUsuario(perfil);
      setNomeUsuario(nome || 'Usuário');
      registrarLog(`Sessão restaurada da memória local como: ${perfil}`);
    } else if (accounts && accounts.length > 0) {
      // Login Microsoft encontrado
      setPerfilUsuario('Leitor'); // Padrão corporativo
      setNomeUsuario(accounts[0].name || accounts[0].username);
      setTokenSessao('microsoft_active_token');
      registrarLog(`Sessão Microsoft identificada para ${accounts[0].name}`);
    }

    inicializarDados();
  }, [accounts]);

  // Carrega / Recarrega dados sempre que o modo ou filtros mudam (se conectados)
  useEffect(() => {
    if (perfilUsuario) {
      carregarDadosServico();
    }
  }, [settings.isMockMode, apenasDisponiveis, authorSelecionado, perfilUsuario]);

  const inicializarDados = () => {
    if (settings.isMockMode) {
      const savedBooks = localStorage.getItem('bibliotec_livros');
      const savedAuthors = localStorage.getItem('bibliotec_autores');
      const savedLoans = localStorage.getItem('bibliotec_emprestimos');

      if (!savedBooks) localStorage.setItem('bibliotec_livros', JSON.stringify(INITIAL_LIVROS));
      if (!savedAuthors) localStorage.setItem('bibliotec_autores', JSON.stringify(INITIAL_AUTORES));
      if (!savedLoans) localStorage.setItem('bibliotec_emprestimos', JSON.stringify(INITIAL_EMPRESTIMOS));

      setLivros(savedBooks ? JSON.parse(savedBooks) : INITIAL_LIVROS);
      setAutores(savedAuthors ? JSON.parse(savedAuthors) : INITIAL_AUTORES);
      setEmprestimos(savedLoans ? JSON.parse(savedLoans) : INITIAL_EMPRESTIMOS);
      registrarLog("Base puramente emulada (Sandbox Local) carregada com sucesso.");
    } else {
      carregarDadosServico();
    }
  };

  // --- COMUNICAÇÕES HTTP COM O BACKEND .NET ---
  const carregarDadosServico = async () => {
    if (settings.isMockMode) {
      // Recarrega do localStorage no modo simulado
      const savedBooks = localStorage.getItem('bibliotec_livros');
      const savedAuthors = localStorage.getItem('bibliotec_autores');
      const savedLoans = localStorage.getItem('bibliotec_emprestimos');

      let l: Livro[] = savedBooks ? JSON.parse(savedBooks) : INITIAL_LIVROS;
      let a: Autor[] = savedAuthors ? JSON.parse(savedAuthors) : INITIAL_AUTORES;
      let e: Emprestimo[] = savedLoans ? JSON.parse(savedLoans) : INITIAL_EMPRESTIMOS;

      // Aplicar filtros a nível de estado (como a API faria)
      if (authorSelecionado) {
        l = l.filter(livro => livro.autorId === authorSelecionado);
      }
      if (apenasDisponiveis) {
        l = l.filter(livro => livro.quantidade > 0);
      }

      setLivros(l);
      setAutores(a);
      setEmprestimos(e);
      setApiOffline(false);
      return;
    }

    setCarregando(true);
    registrarLog("Iniciando requisições assíncronas para a API .NET...");
    
    try {
      const headers = tokenSessao ? { 'Authorization': `Bearer ${tokenSessao}` } : {};
      
      // Carregar Autores
      let urlAutores = `${settings.apiUrl}/autor`;
      const resAutores = await axios.get(urlAutores);
      setAutores(resAutores.data);
      registrarLog(`Autores recebidos do backend: ${resAutores.data.length} registros.`);

      // Carregar Livros com filtros
      let urlLivros = `${settings.apiUrl}/livro`;
      if (authorSelecionado) {
        urlLivros = `${settings.apiUrl}/livro/${authorSelecionado}/livros`;
      } else if (apenasDisponiveis) {
        urlLivros = `${settings.apiUrl}/livro/disponiveis?disponivel=true`;
      }

      const resLivros = await axios.get(urlLivros, { headers });
      setLivros(resLivros.data);
      registrarLog(`Livros carregados do backend: ${resLivros.data.length} registros.`);

      // Carregar Empréstimos
      if (tokenSessao) {
        const resEmprestimos = await axios.get(`${settings.apiUrl}/Emprestimo/meus-emprestimos`, { headers });
        setEmprestimos(resEmprestimos.data);
        registrarLog(`Empréstimos pessoais carregados: ${resEmprestimos.data.length} registros.`);
      }
      setApiOffline(false);
    } catch (e: any) {
      registrarLog(`Erro de conexão com a API: ${e.message}`);
      setApiOffline(true);
      // Fallback para não quebrar a tela
      console.error("Falha ao comunicar com a API Dotnet local:", e);
    } finally {
      setCarregando(false);
    }
  };

  // Testar conexão com a API local
  const testarConexaoApi = async () => {
    setTestConnectionStatus('testing');
    registrarLog(`Pingando barramento da API em ${settings.apiUrl}/autor...`);
    try {
      await axios.get(`${settings.apiUrl}/autor`);
      setTestConnectionStatus('success');
      setApiOffline(false);
      registrarLog("Sucesso! Endpoint respondeu corretamente.");
    } catch (e: any) {
      setTestConnectionStatus('failed');
      setApiOffline(true);
      registrarLog(`Falha na resposta da API: ${e.message}. Verifique o CORS ou se o serviço C# está rodando.`);
    }
  };

  // --- LÓGICA DO LOGIN LOCAL TRADICIONAL ---
  const handleLoginTradicional = async (e: React.FormEvent) => {
    e.preventDefault();
    setCarregandoLogin(true);
    registrarLog(`Tentativa de login local para: ${emailForm}`);

    if (settings.isMockMode) {
      setTimeout(() => {
        // Simulação instantânea
        if (emailForm.includes('admin') || emailForm.includes('colaborador')) {
          setPerfilUsuario('Admin');
          setNomeUsuario('Administrador Fiotec');
          setTokenSessao('sim_token_admin_9921');
          localStorage.setItem('token_bibliotec', 'sim_token_admin_9921');
          localStorage.setItem('perfil_bibliotec', 'Admin');
          localStorage.setItem('nome_usuario_comum', 'Administrador Fiotec');
          registrarLog("Sucesso! Autenticado localmente como administrador simulado.");
        } else {
          setPerfilUsuario('Leitor');
          setNomeUsuario('Leitor Conectado');
          setTokenSessao('sim_token_leitor_4821');
          localStorage.setItem('token_bibliotec', 'sim_token_leitor_4821');
          localStorage.setItem('perfil_bibliotec', 'Leitor');
          localStorage.setItem('nome_usuario_comum', 'Leitor Conectado');
          registrarLog("Sucesso! Autenticado localmente como leitor simulado.");
        }
        setCarregandoLogin(false);
        inicializarDados();
      }, 800);
      return;
    }

    try {
      const response = await axios.post(`${settings.apiUrl}/autenticacao/login`, {
        email: emailForm,
        password: senhaForm
      });
      const { token, usuario } = response.data;
      
      localStorage.setItem("token_bibliotec", token);
      localStorage.setItem("perfil_bibliotec", usuario.permissao);
      localStorage.setItem("nome_usuario_comum", usuario.nome);

      setTokenSessao(token);
      setPerfilUsuario(usuario.permissao);
      setNomeUsuario(usuario.nome);
      setApiOffline(false);
      registrarLog(`Sucesso! Autenticado via API tradicional como: ${usuario.permissao}`);
      
      // Carregar dados iniciais após login
      carregarDadosServico();
    } catch (error: any) {
      const errorMsg = error.response?.data?.mensagem || "Conectividade offline ou senha incorreta.";
      alert(`Falha no Login: ${errorMsg}`);
      registrarLog(`Erro de login: ${errorMsg}`);
    } finally {
      setCarregandoLogin(false);
    }
  };

    const handleLoginMicrosoft = async () => {
        // 1. Proteção absoluta: Se a biblioteca já estiver processando, aborta na hora
        if (inProgress !== 'none') {
            registrarLog(`Autenticação já em andamento. Status: ${inProgress}`);
            return;
        }

        if (!instance) {
            registrarLog("Erro: Instância do MSAL indisponível.");
            return;
        }

        registrarLog("Iniciando caixa de diálogo Microsoft Azure login...");

        try {
            // 🚀 A única e exclusiva chamada de popup do arquivo inteiro
            const result = await instance.loginPopup({
                ...loginRequest,
                prompt: "select_account"
            });

            if (result && result.account) {
                setPerfilUsuario('Leitor'); // Padrão corporativo Fiotec
                setNomeUsuario(result.account.name || result.account.username);
                setTokenSessao('microsoft_active_token');

                localStorage.setItem('token_bibliotec', 'microsoft_active_token');
                localStorage.setItem('perfil_bibliotec', 'Leitor');
                localStorage.setItem('nome_usuario_comum', result.account.name || result.account.username);

                registrarLog(`Sucesso! Sessão Microsoft iniciada para: ${result.account.name}`);

                if (!settings.isMockMode) {
                    carregarDadosServico();
                }
            }
        } catch (e: any) {
            console.error("Erro na autenticação via Popup:", e);
            registrarLog(`Erro ao logar com Microsoft AD: ${e.message}`);

            if (!e.message?.includes("user_cancelled")) {
                alert(`Falha na autenticação Microsoft: ${e.message}`);
            }
        }
    };

  // Logout Geral
  const handleLogout = () => {
    registrarLog("Sessão finalizada.");
    localStorage.removeItem("token_bibliotec");
    localStorage.removeItem("perfil_bibliotec");
    localStorage.removeItem("nome_usuario_comum");
    setTokenSessao(null);
    setPerfilUsuario(null);
    setNomeUsuario(null);
    
    if (instance && accounts.length > 0) {
      try {
        instance.logoutPopup({
          postLogoutRedirectUri: window.location.origin,
          mainWindowRedirectUri: window.location.origin
        });
      } catch (e: any) {
        console.warn("Falha no logout popup do MSAL, limpando sessão localmente.", e);
      }
    }
  };

  // --- SOLICITAR EMPRÉSTIMO ---
  const handleSolicitarEmprestimo = async (livro: Livro) => {
    if (livro.quantidade <= 0) {
      alert("Este exemplar não tem saldo disponível no estoque.");
      return;
    }

    const confirmar = window.confirm(`Confirmar que deseja retirar um exemplar de: "${livro.nome}"?`);
    if (!confirmar) return;

    registrarLog(`Solicitando empréstimo de: ${livro.nome}`);

    if (settings.isMockMode) {
      // Simulação em localStorage
      const savedBooks = localStorage.getItem('bibliotec_livros') || JSON.stringify(INITIAL_LIVROS);
      const savedLoans = localStorage.getItem('bibliotec_emprestimos') || JSON.stringify(INITIAL_EMPRESTIMOS);
      
      let curBooks: Livro[] = JSON.parse(savedBooks);
      let curLoans: Emprestimo[] = JSON.parse(savedLoans);

      // Atualiza estoque livro
      curBooks = curBooks.map(b => b.id === livro.id ? { ...b, quantidade: b.quantidade - 1 } : b);
      
      // Cria novo empréstimo
      const nuevoEmprestimo: Emprestimo = {
        id: "emp_" + Math.random().toString(36).substr(2, 9),
        livroId: livro.id,
        tituloLivro: livro.nome,
        generoLivro: livro.genero,
        dataEmprestimo: new Date().toISOString(),
        dataDevolucao: null,
        ativo: true
      };

      curLoans = [nuevoEmprestimo, ...curLoans];

      localStorage.setItem('bibliotec_livros', JSON.stringify(curBooks));
      localStorage.setItem('bibliotec_emprestimos', JSON.stringify(curLoans));

      setLivros(curBooks);
      setEmprestimos(curLoans);
      setLivroDetalhe(null);

      registrarLog(`Sucesso! Retirada registrada comercialmente do livro: ${livro.nome}`);
      alert(`Empréstimo de "${livro.nome}" solicitado com sucesso!`);
      return;
    }

    try {
      const headers = { 'Authorization': `Bearer ${tokenSessao}` };
      const payload = {
        livroId: livro.id,
        dataEmprestimo: new Date().toISOString()
      };
      await axios.post(`${settings.apiUrl}/Emprestimo`, payload, { headers });
      registrarLog(`Retirada aceita com sucesso via backend.`);
      setLivroDetalhe(null);
      carregarDadosServico();
      alert("Empréstimo solicitado na base principal!");
    } catch (error: any) {
      const errorMsg = error.response?.data?.mensagem || "Ocorreu uma falha ao contatar a API.";
      alert(`Erro: ${errorMsg}`);
      registrarLog(`Falha no empréstimo: ${errorMsg}`);
    }
  };

  // --- PROCESSAR DEVOLUÇÃO ---
  const handleDevolverLivro = async (emprestimo: Emprestimo) => {
    const confirmar = window.confirm(`Deseja realizar a devolução deste exemplar ao acervo?`);
    if (!confirmar) return;

    registrarLog(`Devolvendo exemplar referente ao ID: ${emprestimo.id}`);

    if (settings.isMockMode) {
      const savedBooks = localStorage.getItem('bibliotec_livros') || JSON.stringify(INITIAL_LIVROS);
      const savedLoans = localStorage.getItem('bibliotec_emprestimos') || JSON.stringify(INITIAL_EMPRESTIMOS);

      let curBooks: Livro[] = JSON.parse(savedBooks);
      let curLoans: Emprestimo[] = JSON.parse(savedLoans);

      // Devolve quantidade ao estoque
      curBooks = curBooks.map(b => b.id === emprestimo.livroId ? { ...b, quantidade: b.quantidade + 1 } : b);
      
      // Fecha o empréstimo
      curLoans = curLoans.map(e => e.id === emprestimo.id ? { ...e, ativo: false, dataDevolucao: new Date().toISOString() } : e);

      localStorage.setItem('bibliotec_livros', JSON.stringify(curBooks));
      localStorage.setItem('bibliotec_emprestimos', JSON.stringify(curLoans));

      setLivros(curBooks);
      setEmprestimos(curLoans);
      registrarLog(`Sucesso! Devolução computada com sucesso localmente.`);
      return;
    }

    try {
      const headers = { 'Authorization': `Bearer ${tokenSessao}` };
      await axios.post(`${settings.apiUrl}/Emprestimo/${emprestimo.id}/devolver`, {}, { headers });
      registrarLog(`Devolução comutada com sucesso via API.`);
      carregarDadosServico();
    } catch (error: any) {
      const errorMsg = error.response?.data?.mensagem || "Erro ao registrar a entrega do acervo.";
      alert(errorMsg);
      registrarLog(`Falha na devolução: ${errorMsg}`);
    }
  };

  // --- CADASTRAR NOVO LIVRO (ADMIN) ---
  const handleCadastrarLivro = async (e: React.FormEvent) => {
    e.preventDefault();
    registrarLog(`Cadastrando obra nova: ${novoLivro.nome}`);

    const autorSelect = autores.find(a => a.id === novoLivro.autorId);

    if (settings.isMockMode) {
      const savedBooks = localStorage.getItem('bibliotec_livros') || JSON.stringify(INITIAL_LIVROS);
      const curBooks: Livro[] = JSON.parse(savedBooks);

      const nuevo: Livro = {
        id: "book_" + Math.random().toString(36).substr(2, 9),
        nome: novoLivro.nome,
        autorId: novoLivro.autorId,
        autorNome: autorSelect?.nome || "Autor Não Identificado",
        autor: { id: novoLivro.autorId, nome: autorSelect?.nome || "Autor Não Identificado" },
        genero: novoLivro.genero,
        ano: parseInt(novoLivro.ano) || new Date().getFullYear(),
        codigo: parseInt(novoLivro.codigo) || 900,
        resumo: novoLivro.resumo,
        quantidade: parseInt(novoLivro.quantidade as any) || 1,
        cor: novoLivro.cor,
        disponivel: true
      };

      const updated = [nuevo, ...curBooks];
      localStorage.setItem('bibliotec_livros', JSON.stringify(updated));
      setLivros(updated);
      
      // Limpa form
      setNovoLivro({
        nome: '',
        autorId: '',
        genero: '',
        ano: '',
        codigo: '',
        resumo: '',
        quantidade: 1,
        cor: '#0082C6'
      });

      registrarLog(`Obra inserida com êxito na sandbox local.`);
      alert("Livro cadastrado na sandbox demonstrativa!");
      setAbaAtiva('catalogo');
      return;
    }

    try {
      const headers = { 'Authorization': `Bearer ${tokenSessao}` };
      const payload = {
        nome: novoLivro.nome,
        autorId: novoLivro.autorId,
        genero: novoLivro.genero,
        ano: parseInt(novoLivro.ano) || 0,
        codigo: parseInt(novoLivro.codigo) || 0,
        resumo: novoLivro.resumo,
        quantidade: parseInt(novoLivro.quantidade as any) || 1,
        disponivel: true
      };

      await axios.post(`${settings.apiUrl}/livro`, payload, { headers });
      registrarLog("Operação enviada com sucesso ao servidor C#.");
      alert("Livro registrado na base do Servidor!");
      setNovoLivro({
        nome: '',
        autorId: '',
        genero: '',
        ano: '',
        codigo: '',
        resumo: '',
        quantidade: 1,
        cor: '#0082C6'
      });
      setAbaAtiva('catalogo');
      carregarDadosServico();
    } catch (error: any) {
      console.error(error);
      alert("Falha ao salvar. Verifique se preencheu todos os dados corretamente e se está logado como Administrador.");
    }
  };

  // --- CADASTRAR NOVO AUTOR (ADMIN) ---
  const handleCadastrarAutor = async () => {
    if (!novoAutorNome.trim()) return;
    registrarLog(`Inserindo autor novo: ${novoAutorNome}`);

    if (settings.isMockMode) {
      const savedAuthors = localStorage.getItem('bibliotec_autores') || JSON.stringify(INITIAL_AUTORES);
      const curAuthors: Autor[] = JSON.parse(savedAuthors);

      const nuevo: Autor = {
        id: "aut_" + Math.random().toString(36).substr(2, 9),
        nome: novoAutorNome
      };

      const updated = [...curAuthors, nuevo];
      localStorage.setItem('bibliotec_autores', JSON.stringify(updated));
      setAutores(updated);
      setNovoAutorNome('');
      setMostrandoAddAutor(false);
      registrarLog(`Autor cadastrado na sandbox.`);
      alert("Autor adicionado à simulação!");
      return;
    }

    try {
      const headers = { 'Authorization': `Bearer ${tokenSessao}` };
      await axios.post(`${settings.apiUrl}/autor`, { nome: novoAutorNome }, { headers });
      setNovoAutorNome('');
      setMostrandoAddAutor(false);
      registrarLog(`Autor registrado no banco principal.`);
      carregarDadosServico();
    } catch (e: any) {
      console.error(e);
      alert("Erro ao criar autor na API.");
    }
  };

  // --- EXCLUIR LIVRO (ADMIN) ---
  const handleExcluirLivro = async (livro: Livro) => {
    const confirmar = window.confirm(`ATENÇÃO: Deseja apagar permanentemente "${livro.nome}" do acervo?`);
    if (!confirmar) return;

    registrarLog(`Apagando livro ID: ${livro.id}`);

    if (settings.isMockMode) {
      const savedBooks = localStorage.getItem('bibliotec_livros') || JSON.stringify(INITIAL_LIVROS);
      let curBooks: Livro[] = JSON.parse(savedBooks);
      curBooks = curBooks.filter(b => b.id !== livro.id);
      localStorage.setItem('bibliotec_livros', JSON.stringify(curBooks));
      setLivros(curBooks);
      registrarLog("Registro removido na sandbox.");
      return;
    }

    try {
      const headers = { 'Authorization': `Bearer ${tokenSessao}` };
      await axios.delete(`${settings.apiUrl}/livro/${livro.id}`, { headers });
      registrarLog("Removido com aprovação do servidor.");
      carregarDadosServico();
    } catch (e: any) {
      console.error(e);
      alert("Erro ao excluir. Apenas administradores possuem este privilégio.");
    }
  };

  // --- RESOLUÇÃO DE FILTROS DO CLIENT-SIDE ---
  const livrosFiltrados = livros.filter(livro => {
    if (!livro || !livro.nome) return false;
    const termoBusca = busca.toLowerCase();
    const tituloBate = livro.nome.toLowerCase().includes(termoBusca);
    const generoBate = livro.genero?.toLowerCase().includes(termoBusca);
    const autorBate = (livro.autorNome || livro.autor?.nome || '').toLowerCase().includes(termoBusca);
    return tituloBate || generoBate || autorBate;
  });

  const emprestimosAtivosList = emprestimos.filter(emp => emp.ativo);
  const emprestimosHistoricoList = emprestimos.filter(emp => !emp.ativo);

  // Quick fill logins demonstrativos
  const fillCredentials = (type: 'admin' | 'reader') => {
    // Forçar o modo Sandbox ativo para garantir que não tente consultar a API .NET offline
    setSettings(prev => ({ ...prev, isMockMode: true }));
    localStorage.setItem('bibliotec_settings', JSON.stringify({ isMockMode: true, apiUrl: settings.apiUrl }));
    
    if (type === 'admin') {
      setEmailForm('colaborador@fiotec.com.br');
      setSenhaForm('123456');
      registrarLog("Modo Sandbox (Emulado) ativado. Credenciais de Administrador prontas.");
    } else {
      setEmailForm('leitor.comum@fiotec.com.br');
      setSenhaForm('123456');
      registrarLog("Modo Sandbox (Emulado) ativado. Credenciais de Leitor prontas.");
    }
  };

  if (!perfilUsuario) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col justify-center items-center p-6 font-sans relative overflow-hidden">
        {/* Subtle decorative background gradients and connection elements (Slide 29 & 1) */}
        <div className="absolute top-0 left-0 w-96 h-96 bg-[#0082C6]/10 rounded-full filter blur-3xl opacity-60 -translate-x-12 -translate-y-12"></div>
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-[#30AEE4]/10 rounded-full filter blur-3xl opacity-50 translate-x-12 translate-y-12"></div>
        
        {/* Network dots matrix decorative layout mimicking slide 41 "+" markers */}
        <div className="absolute top-12 right-12 text-slate-200 font-bold select-none text-xl hidden lg:block tracking-widest leading-none pointer-events-none opacity-40 font-mono">
          + + +<br />+ + +<br />+ + +
        </div>

        {/* Logo and title brand designed precisely after Fiotec slide 6 */}
        <div className="flex items-center gap-3 mb-8 relative z-10">
          <div className="w-10 h-10 bg-[#0082C6] rounded-xl flex items-center justify-center shadow-lg shadow-[#0082C6]/20">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-5 w-5 text-white">
              <path d="M4 20h16M6 20v-8l1-1h2l1 1v8M14 20v-8l1-1h2l1 1v8M10 20v-5h4v5M7 11V7l1-1h1l1 1v4M15 11V7l1-1h1l1 1v4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div>
            <span className="text-xl font-black text-[#4E4E4E] tracking-tight block leading-none">
              Fio<span className="text-[#0082C6]">Tec</span>
            </span>
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-widest block mt-1">
              Plataforma Bibliotec • Gestão
            </span>
          </div>
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className={`w-full bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden relative z-10 ${
            mostrarAcessoLocal 
              ? 'max-w-4xl grid grid-cols-1 md:grid-cols-2' 
              : 'max-w-md'
          }`}
        >
          {mostrarAcessoLocal && (
            /* Form Login Local */
            <div className="p-8 flex flex-col justify-between border-r border-slate-100 bg-white">
              <div>
                <div className="flex items-center justify-between gap-2 mb-4">
                  <div className="flex items-center gap-2 text-[#4E4E4E]">
                    <Lock className="text-[#0082C6]" size={18} />
                    <h2 className="text-base font-bold text-[#4E4E4E] font-sans tracking-tight">Acesso Local</h2>
                  </div>
                  <div className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider ${settings.isMockMode ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-[#0082C6]/10 text-[#0082C6] border border-[#0082C6]/20'}`}>
                    {settings.isMockMode ? "Sandbox" : "API .NET"}
                  </div>
                </div>
                <p className="text-xs text-slate-400 mb-6 leading-relaxed font-sans">
                  Entre com seu e-mail institucional e senha cadastrados no sistema.
                </p>

                {!settings.isMockMode && (
                  <div className="mb-5 text-[11px] bg-amber-50/80 border border-amber-200 text-amber-800 rounded-xl p-3 flex flex-col gap-2">
                    <div className="flex items-center gap-1.5 font-bold text-amber-900">
                      <AlertTriangle size={14} className="shrink-0" />
                      <span>Conexão com a API .NET Ativa</span>
                    </div>
                    <p className="text-slate-600 font-medium leading-relaxed">
                      Sua plataforma está configurada para conectar a um servidor tradicional rodando localmente.
                    </p>
                    <button 
                      type="button"
                      onClick={() => {
                        setSettings(prev => ({ ...prev, isMockMode: true }));
                        localStorage.setItem('bibliotec_settings', JSON.stringify({ isMockMode: true, apiUrl: settings.apiUrl }));
                        registrarLog("Modo Sandbox ativado manualmente via atalho no login.");
                      }}
                      className="self-start text-[10px] font-black bg-[#0082C6] text-white hover:bg-[#0074B2] border-0 py-1.5 px-3 rounded-lg transition uppercase cursor-pointer"
                    >
                      Ativar Versão Sandbox (Sem API)
                    </button>
                  </div>
                )}

                <form onSubmit={handleLoginTradicional} className="flex flex-col gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-[#4E4E4E] mb-2 uppercase tracking-wider">E-mail Corporativo</label>
                    <input 
                      type="email" 
                      value={emailForm}
                      onChange={(e) => setEmailForm(e.target.value)}
                      placeholder="nome@fiotec.fiocruz.br"
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-[#0082C6] focus:ring-2 focus:ring-[#0082C6]/10 outline-none text-sm transition"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-[#4E4E4E] mb-2 uppercase tracking-wider">Senha de Acesso</label>
                    <input 
                      type="password" 
                      value={senhaForm}
                      onChange={(e) => setSenhaForm(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-[#0082C6] focus:ring-2 focus:ring-[#0082C6]/10 outline-none text-sm transition"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={carregandoLogin}
                    className="w-full bg-[#0082C6] hover:bg-[#0074B2] active:bg-[#006093] text-white font-semibold py-3 px-4 rounded-xl text-sm mt-4 transition-all flex justify-center items-center gap-2 shadow-lg shadow-[#0082C6]/10 cursor-pointer"
                  >
                    {carregandoLogin ? (
                      <>
                        <RefreshCw size={16} className="animate-spin" />
                        <span>Autenticando...</span>
                      </>
                    ) : (
                      <span>Entrar no Sistema</span>
                    )}
                  </button>
                </form>
              </div>

              {/* Quick Access Helper */}
              <div className="mt-8 pt-6 border-t border-slate-100 bg-slate-50/50 -mx-8 -mb-8 p-8 font-sans">
                <span className="text-[10px] font-bold text-[#4E4E4E] tracking-widest block mb-3 uppercase">
                  Acesso de Teste (Sandbox)
                </span>
                <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={() => fillCredentials('reader')}
                    className="border border-[#0082C6]/20 bg-[#0082C6]/5 hover:bg-[#0082C6]/10 text-[#0082C6] text-xs py-2 px-3 rounded-xl font-semibold transition text-center cursor-pointer"
                  >
                    ✓ Perfil Leitor
                  </button>
                  <button 
                    onClick={() => fillCredentials('admin')}
                    className="border border-[#9E519F]/20 bg-[#9E519F]/5 hover:bg-[#9E519F]/10 text-[#9E519F] text-xs py-2 px-3 rounded-xl font-semibold transition text-center cursor-pointer"
                  >
                    ✦ Perfil Admin
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Login Corporativo Azure */}
          <div className={`${mostrarAcessoLocal ? 'bg-slate-50' : 'bg-white'} p-8 flex flex-col justify-between text-center items-center relative min-h-[380px]`}>
            {/* Hexágonos decorativos sutilmente aplicados em BG no lado Azure (Slide 45-46) */}
            <div className="absolute top-4 right-4 text-slate-200 select-none pointer-events-none opacity-40">
              <svg className="w-16 h-16" viewBox="0 0 100 100" fill="currentColor">
                <polygon points="50,1 95,25 95,75 50,99 5,75 5,25" fill="none" stroke="currentColor" strokeWidth="3" />
              </svg>
            </div>

            <div className="my-auto py-8 relative z-10">
              <div className="w-14 h-14 bg-white text-[#0082C6] rounded-2xl flex items-center justify-center mx-auto mb-6 border border-slate-200 shadow-md">
                <Globe size={26} />
              </div>
              <h2 className="text-xl font-bold text-[#4E4E4E] mb-2">Acesso Corporativo</h2>
              <p className="text-sm text-slate-400 max-w-xs mx-auto mb-6 leading-relaxed">
                Utilize suas credenciais oficiais do pacote Microsoft Office 365 cadastrado na organização.
              </p>

              <button
                onClick={handleLoginMicrosoft}
                className="w-full bg-slate-900 hover:bg-black text-white font-semibold py-3.5 px-6 rounded-xl text-sm transition-all flex justify-center items-center gap-3 shadow-md cursor-pointer"
              >
                <span className="bg-white/10 p-1 rounded">
                  <svg width="18" height="18" viewBox="0 0 23 23">
                    <path fill="#f3f2f1" d="M0 0h23v23H0z"/>
                    <path fill="#f25022" d="M1 1h10v10H1z"/>
                    <path fill="#7fba00" d="M12 1h10v10H12z"/>
                    <path fill="#00a4ef" d="M1 12h10v10H1z"/>
                    <path fill="#ffb900" d="M12 12h10v10H12z"/>
                  </svg>
                </span>
                Conectar via Microsoft
              </button>
              
              {instance === null && (
                <div className="mt-4 flex items-center gap-1.5 justify-center text-[11px] text-amber-700 bg-amber-50 px-3 py-2 rounded-xl border border-amber-100 max-w-xs mx-auto leading-tight">
                  <AlertTriangle size={13} className="shrink-0" />
                  <span>Modo Sandbox ativado (cookies de iFrame travados)</span>
                </div>
              )}
            </div>

            <div className="border-t border-slate-200/60 py-4 w-full text-xs text-slate-400 font-medium relative z-10">
              Autenticação federada e criptografada via Active Directory
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen w-full bg-slate-50 text-slate-700 font-sans overflow-hidden">
      
      {/* HEADER */}
      <header className="h-16 flex items-center justify-between px-8 bg-white border-b border-slate-200 shrink-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-[#0082C6] rounded-lg flex items-center justify-center shadow-md shadow-[#0082C6]/10">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-5 w-5 text-white">
              <path d="M4 20h16M6 20v-8l1-1h2l1 1v8M14 20v-8l1-1h2l1 1v8M10 20v-5h4v5M7 11V7l1-1h1l1 1v4M15 11V7l1-1h1l1 1v4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div>
            <span className="text-base font-black text-[#4E4E4E] tracking-tight block leading-none">
              Fio<span className="text-[#0082C6]">Tec</span>
            </span>
            <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Bibliotec</span>
          </div>
        </div>

        {/* Global Search tied directly to the catalog tab! */}
        <div className="relative">
          <input 
            type="text" 
            placeholder="Pesquisar livros, autores..." 
            value={busca}
            onChange={(e) => {
              setBusca(e.target.value);
              if (abaAtiva !== 'catalogo' && e.target.value !== '') {
                setAbaAtiva('catalogo');
              }
            }}
            className="w-80 h-10 pl-10 pr-4 rounded-full bg-slate-50 border border-slate-200 text-sm focus:border-[#0082C6] focus:ring-2 focus:ring-[#0082C6]/10 hover:bg-slate-100 transition-all text-slate-800 outline-none"
          />
          <Search className="h-4 w-4 absolute left-3.5 top-3 text-slate-400" />
        </div>

        {/* Dynamic Logged In profile */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 border-l border-slate-200 pl-6">
            <div className="text-right">
              <p className="text-xs font-semibold text-slate-700 leading-tight">{nomeUsuario || 'Usuário'}</p>
              <p className="text-[10px] text-slate-400 font-bold uppercase">{perfilUsuario}</p>
            </div>
            <div className="w-9 h-9 bg-[#0082C6]/10 text-[#0082C6] font-bold rounded-full border border-slate-200 flex items-center justify-center text-xs">
              {(nomeUsuario || 'US').substring(0, 2).toUpperCase()}
            </div>
          </div>
        </div>
      </header>

      {/* DYNAMIC SIDEBAR + WORKSPACE */}
      <div className="flex flex-1 overflow-hidden">
        
        {/* SIDEBAR ASIDE */}
        <aside className="w-64 bg-white border-r border-slate-200 flex flex-col justify-between shrink-0 font-sans">
          <nav className="flex-1 py-6 flex flex-col">
            <p className="px-6 text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Menu Principal</p>
            
            <button 
              onClick={() => setAbaAtiva('catalogo')} 
              className={`flex items-center gap-3 px-6 py-3 text-sm font-semibold transition text-left cursor-pointer ${
                abaAtiva === 'catalogo' 
                  ? 'bg-[#0082C6]/5 text-[#0082C6] border-r-4 border-[#0082C6]' 
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <BookOpen className="w-4 h-4 text-slate-400" />
              Acervo Geral
            </button>

            <button 
              onClick={() => setAbaAtiva('pendentes')} 
              className={`flex items-center gap-3 px-6 py-3 text-sm font-semibold transition text-left relative cursor-pointer ${
                abaAtiva === 'pendentes' 
                  ? 'bg-[#0082C6]/5 text-[#0082C6] border-r-4 border-[#0082C6]' 
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Clock className="w-4 h-4 text-slate-400" />
              Livros Pendentes
              {emprestimosAtivosList.length > 0 && (
                <span className="absolute right-6 bg-[#F6851F] text-white text-[9px] w-5 h-5 rounded-full flex items-center justify-center font-bold border-2 border-white animate-bounce">
                  {emprestimosAtivosList.length}
                </span>
              )}
            </button>

            <button 
              onClick={() => setAbaAtiva('historico')} 
              className={`flex items-center gap-3 px-6 py-3 text-sm font-semibold transition text-left cursor-pointer ${
                abaAtiva === 'historico' 
                  ? 'bg-[#0082C6]/5 text-[#0082C6] border-r-4 border-[#0082C6]' 
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <CheckCircle className="w-4 h-4 text-slate-400" />
              Histórico de Devoluções
            </button>

            {(perfilUsuario === 'Admin' || perfilUsuario === 'Colaborador') && (
              <button 
                onClick={() => setAbaAtiva('admin')} 
                className={`flex items-center gap-3 px-6 py-3 text-sm font-semibold transition text-left cursor-pointer ${
                  abaAtiva === 'admin' 
                    ? 'bg-[#9E519F]/5 text-[#9E519F] border-r-4 border-[#9E519F]' 
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Plus className="w-4 h-4 text-slate-400" />
                Gestão Administrador
              </button>
            )}

            <p className="px-6 text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-8 mb-4">Outras Ações</p>
            
            <button 
              onClick={() => setShowSettingsSidebar(true)}
              className="flex items-center gap-3 px-6 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition text-left cursor-pointer"
            >
              <Sliders className="w-4 h-4 text-slate-400" />
              Configurar Conexão
            </button>

            <button 
              onClick={handleLogout}
              className="flex items-center gap-3 px-6 py-3 text-sm font-semibold text-red-600 hover:bg-red-50/50 transition text-left mt-auto cursor-pointer"
            >
              <LogOut className="w-4 h-4 text-red-400" />
              Encerrar Sessão
            </button>
          </nav>

          {/* Sincronização Estilizada (simulando Upgrade Box da Fiotec) */}
          <div className="p-6">
            <div className="bg-[#0082C6]/5 border border-[#0082C6]/10 rounded-xl p-4">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-[#0082C6] mb-1">
                <Database size={13} className={settings.isMockMode ? "text-[#0082C6]" : "text-[#70BF4A]"} />
                <span>Base de Dados</span>
              </div>
              <p className="text-[10px] text-slate-400 mb-3 leading-tight">
                {settings.isMockMode 
                  ? "Atualmente operando no modo demonstração com sandbox local." 
                  : "Sincronizado via barramento com banco principal."
                }
              </p>
              <button 
                onClick={() => setShowSettingsSidebar(true)}
                className="w-full py-2 bg-[#0082C6] text-white text-[10px] font-bold uppercase rounded-lg shadow-md shadow-[#0082C6]/10 hover:bg-[#0074B2] transition cursor-pointer font-sans"
              >
                Configurar Base
              </button>
            </div>
          </div>
        </aside>

        {/* WORKSPACE MAIN AREA */}
        <main className="flex-1 p-8 flex flex-col gap-6 overflow-y-auto">
          
          {/* OFFLINE BANNER */}
          {apiOffline && !settings.isMockMode && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-[#F04A42]/10 border border-[#F04A42]/30 rounded-xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 shrink-0"
            >
              <div className="flex gap-3">
                <div className="w-10 h-10 bg-[#F04A42]/10 rounded-lg flex items-center justify-center shrink-0 border border-[#F04A42]/20">
                  <AlertTriangle className="text-[#F04A42]" size={20} />
                </div>
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-[#F04A42] leading-tight">Erro de Conectividade com a API C# (.NET)</h4>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Não foi possível consultar os endpoints em <code className="text-[11px] font-mono font-bold bg-slate-100/80 px-1 py-0.5 rounded text-gray-700">{settings.apiUrl}</code>. Verifique se o seu backend local está rodando ou se há pendências de CORS.
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setSettings({ ...settings, isMockMode: true })}
                className="py-2 px-3 bg-[#0082C6] text-white text-[11px] font-bold rounded-lg transition hover:bg-[#0074B2] cursor-pointer shrink-0 font-sans shadow-xs mt-1 sm:mt-0"
              >
                Ativar Demonstração Local (Offline)
              </button>
            </motion.div>
          )}

          {/* STATS TILES BANNER */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 shrink-0">
            
            {/* CARD 1 */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 card-shadow flex flex-col justify-between">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Títulos no Acervo</p>
              <div className="flex items-end justify-between">
                <h3 className="text-2xl font-bold text-slate-800">{livros.length}</h3>
                <span className="text-[10px] font-bold text-[#0082C6] bg-[#0082C6]/10 px-2 py-0.5 rounded-full">Sincronizado</span>
              </div>
            </div>

            {/* CARD 2 */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 card-shadow flex flex-col justify-between">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Empréstimos Ativos</p>
              <div className="flex items-end justify-between">
                <h3 className="text-2xl font-bold text-slate-800">{emprestimosAtivosList.length}</h3>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  emprestimosAtivosList.length > 0 ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'
                }`}>
                  {emprestimosAtivosList.length > 0 ? 'Pendente' : 'Em dia'}
                </span>
              </div>
            </div>

            {/* CARD 3 */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 card-shadow flex flex-col justify-between">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Devoluções Registradas</p>
              <div className="flex items-end justify-between">
                <h3 className="text-2xl font-bold text-slate-800">{emprestimosHistoricoList.length}</h3>
                <span className="text-[10px] font-bold text-emerald-500 bg-emerald-50 px-2 py-0.5 rounded-full">Histórico</span>
              </div>
            </div>

            {/* CARD 4 */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 card-shadow flex flex-col justify-between">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Autores Ativos</p>
              <div className="flex items-end justify-between">
                <h3 className="text-2xl font-bold text-slate-800">{autores.length}</h3>
                <span className="text-[10px] font-bold text-purple-500 bg-purple-50 px-2 py-0.5 rounded-full font-serif font-semibold">Parceiros</span>
              </div>
            </div>

          </div>

          <div className="flex-1 bg-white rounded-xl border border-slate-200 card-shadow overflow-hidden flex flex-col min-h-0 min-w-0">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0 font-sans">
              <h2 className="text-sm font-bold text-slate-800 tracking-tight uppercase">
                {abaAtiva === 'catalogo' && "Ficha de Acervos Disponíveis"}
                {abaAtiva === 'pendentes' && "Seus Livros Sem Devolução"}
                {abaAtiva === 'historico' && "Histórico Geral de Empréstimos Realizados"}
                {abaAtiva === 'admin' && "Configurações e Gestão Administrativa"}
              </h2>
              <span className="text-[11px] text-slate-400 font-mono">FIOTEC CORP</span>
            </div>

            <div className="flex-1 overflow-y-auto p-6 min-h-0">
              <AnimatePresence mode="wait">
                
                {/* --- ABA 1: CATÁLOGO DE LIVROS --- */}
                {abaAtiva === 'catalogo' && (
                  <motion.div
                    key="catalogo-tab"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="flex flex-col gap-6"
                  >
                    {/* Barra de Filtros Avançados */}
                    <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs flex flex-col md:flex-row gap-4 items-center">
                      <div className="relative flex-1 w-full">
                        <Search className="absolute left-3.5 top-3 text-gray-400" size={18} />
                        <input 
                          type="text"
                          value={busca}
                          onChange={(e) => setBusca(e.target.value)}
                          placeholder="Buscar por título, autor ou gênero literário..."
                          className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-gray-300 focus:border-[#0082C6] focus:ring-1 focus:ring-[#0082C6] outline-none text-sm transition"
                        />
                      </div>

                      <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
                        <select
                          value={authorSelecionado}
                          onChange={(e) => setAuthorSelecionado(e.target.value)}
                          className="w-full sm:w-48 px-4 py-2.5 rounded-xl border border-gray-300 focus:border-[#0082C6] focus:ring-1 focus:ring-[#0082C6] outline-none text-sm transition bg-white"
                        >
                          <option value="">Todos os Autores</option>
                          {autores.map(a => (
                            <option key={a.id} value={a.id}>{a.nome}</option>
                          ))}
                        </select>

                        <label className="flex items-center gap-2 cursor-pointer select-none text-sm font-semibold text-gray-600 py-2 sm:py-0">
                          <input 
                            type="checkbox"
                            checked={apenasDisponiveis}
                            onChange={(e) => setApenasDisponiveis(e.target.checked)}
                            className="rounded text-[#0082C6] focus:ring-[#0082C6] w-4.5 h-4.5"
                          />
                          <span>Apenas Disponíveis</span>
                        </label>
                      </div>
                    </div>

                    {/* Exibição em Grid */}
                    {carregando ? (
                      <div className="py-24 text-center flex flex-col items-center gap-3">
                        <RefreshCw className="animate-spin text-[#0082C6] stroke-[2.5]" size={32} />
                        <p className="text-gray-400 text-sm font-medium">Sincronizando acervo com a base ativa...</p>
                      </div>
                    ) : livrosFiltrados.length === 0 ? (
                      <div className="py-20 text-center bg-white border border-gray-200 rounded-2xl p-8">
                        <Info className="mx-auto text-gray-300 mb-3" size={40} />
                        <h3 className="text-lg font-bold text-gray-700">Nenhum exemplar localizado</h3>
                        <p className="text-gray-400 text-sm max-w-sm mx-auto mt-1">
                          Nenhum livro corresponde à filtragem atual. Tente redefinir a busca ou adicione novos registros no painel administrativo.
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {livrosFiltrados.map(livro => {
                          const hasStock = livro.quantidade > 0;
                          return (
                            <motion.div
                              onClick={() => setLivroDetalhe(livro)}
                              key={livro.id}
                              whileHover={{ y: -4, boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.08)' }}
                              className="bg-white rounded-2xl border border-gray-200 overflow-hidden cursor-pointer transition-all flex flex-col justify-between relative shadow-xs"
                            >
                              {/* Lombada Colorida do CDD do Livro */}
                              <div style={{ backgroundColor: livro.cor || '#0082C6' }} className="h-2 w-full" />
                              
                              <div className="p-5 flex flex-col justify-between flex-1 gap-4">
                                <div className="flex flex-col gap-2">
                                  <div className="flex justify-between items-start gap-2">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 bg-gray-50 border border-gray-100 px-2 py-0.5 rounded">
                                      {livro.genero || 'Geral'}
                                    </span>
                                    <span className="text-[10px] font-mono px-2 py-0.5 rounded text-white font-semibold" style={{ backgroundColor: livro.cor || '#4E4E4E' }}>
                                      CDD {livro.codigo || '000'}
                                    </span>
                                  </div>

                                  <h3 className="font-extrabold text-base text-gray-800 line-clamp-2 leading-tight">
                                    {livro.nome}
                                  </h3>
                                  <p className="text-xs text-gray-400 font-medium">
                                    Autor: <span className="text-[#0082C6] font-bold">{livro.autorNome || livro.autor?.nome || 'Não informado'}</span>
                                  </p>
                                </div>

                                <p className="text-xs text-gray-400 line-clamp-3 leading-relaxed">
                                  {livro.resumo || "Não há ficha catalográfica resumida registrada para este exemplar."}
                                </p>

                                <div className="pt-4 border-t border-gray-100 flex justify-between items-center mt-auto">
                                  <div className="flex flex-col">
                                    <span className={`text-[10px] font-extrabold ${hasStock ? 'text-emerald-500' : 'text-red-500'}`}>
                                      {hasStock ? '• DISPONÍVEL' : '• ESGOTADO'}
                                    </span>
                                    <span className="text-[10px] font-semibold text-gray-400">Estoque: {livro.quantidade} un</span>
                                  </div>
                                  <span className="text-xs text-[#0082C6] font-extrabold hover:underline">Ver Detalhes →</span>
                                </div>
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>
                    )}
                  </motion.div>
                )}

                {/* --- ABA 2: LIVROS PENDENTES --- */}
                {abaAtiva === 'pendentes' && (
                  <motion.div
                    key="pendentes-tab"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs"
                  >
                    <div className="flex items-center gap-2 mb-6">
                      <Clock className="text-[#0082C6]" />
                      <h2 className="text-lg font-bold text-gray-800">Seus Exemplares Pendentes de Devolução</h2>
                    </div>

                    {emprestimosAtivosList.length === 0 ? (
                      <div className="text-center py-16">
                        <Check className="mx-auto text-emerald-500 bg-emerald-50 p-2.5 rounded-full border border-emerald-100 mb-3" size={44} />
                        <h3 className="text-sm font-bold text-gray-700">Tudo em dia!</h3>
                        <p className="text-xs text-gray-400 mt-1 max-w-xs mx-auto">
                          Você não possui pendências ou exemplares pendentes de entrega no momento.
                        </p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-left text-sm">
                          <thead>
                            <tr className="border-b border-gray-200 text-xs text-gray-400 uppercase font-black">
                              <th className="py-4 px-4">Título do Livro</th>
                              <th className="py-4 px-4">Gênero</th>
                              <th className="py-4 px-4">Data de Retirada</th>
                              <th className="py-4 px-4">Status</th>
                              <th className="py-4 px-4 text-right">Ação</th>
                            </tr>
                          </thead>
                          <tbody>
                            {emprestimosAtivosList.map(emp => (
                              <tr key={emp.id} className="border-b border-gray-100 hover:bg-gray-50/50">
                                <td className="py-4 px-4 font-bold text-gray-800">{emp.tituloLivro || "Exemplar de Leitura"}</td>
                                <td className="py-4 px-4 font-medium text-gray-400">{emp.generoLivro || "Literatura Geral"}</td>
                                <td className="py-4 px-4 text-gray-500">
                                  {new Date(emp.dataEmprestimo).toLocaleDateString('pt-BR')}
                                </td>
                                <td className="py-4 px-4">
                                  <span className="bg-amber-50 text-amber-600 border border-amber-100 text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase">
                                    Pendente
                                  </span>
                                </td>
                                <td className="py-4 px-4 text-right">
                                  <button
                                    onClick={() => handleDevolverLivro(emp)}
                                    className="bg-emerald-50 hover:bg-emerald-100 text-emerald-600 border border-emerald-100 font-bold text-xs px-3.5 py-1.5 rounded-lg transition cursor-pointer"
                                  >
                                    Devolver Obra
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </motion.div>
                )}

                {/* --- ABA 3: HISTÓRICO DE DEVOLUÇÕES --- */}
                {abaAtiva === 'historico' && (
                  <motion.div
                    key="historico-tab"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs"
                  >
                    <div className="flex items-center gap-2 mb-6">
                      <CheckCircle className="text-[#0082C6]" />
                      <h2 className="text-lg font-bold text-gray-800 font-sans">Seu Histórico Completo de Encontros</h2>
                    </div>

                    {emprestimosHistoricoList.length === 0 ? (
                      <div className="text-center py-16">
                        <FileText className="mx-auto text-gray-300 mb-3" size={32} />
                        <h3 className="text-sm font-bold text-gray-500">Histórico Limpo</h3>
                        <p className="text-xs text-gray-400 mt-1">Nenhum registro de devolução ou transações passadas de devoluções.</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-left text-sm">
                          <thead>
                            <tr className="border-b border-gray-200 text-xs text-gray-400 uppercase font-bold">
                              <th className="py-4 px-4">Nome do Exemplar</th>
                              <th className="py-4 px-4">Gênero Literário</th>
                              <th className="py-4 px-4">Data Retirada</th>
                              <th className="py-4 px-4">Data Entrega</th>
                              <th className="py-4 px-4">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {emprestimosHistoricoList.map(emp => (
                              <tr key={emp.id} className="border-b border-gray-100 hover:bg-gray-50/50">
                                <td className="py-4 px-4 font-bold text-gray-800">{emp.tituloLivro || "Exemplar de Leitura"}</td>
                                <td className="py-4 px-4 text-gray-400 font-medium">{emp.generoLivro || "Literatura Geral"}</td>
                                <td className="py-4 px-4 text-gray-500">
                                  {new Date(emp.dataEmprestimo).toLocaleDateString('pt-BR')}
                                </td>
                                <td className="py-4 px-4 text-emerald-600 font-medium">
                                  {emp.dataDevolucao ? new Date(emp.dataDevolucao).toLocaleDateString('pt-BR') : 'Concluído'}
                                </td>
                                <td className="py-4 px-4">
                                  <span className="bg-emerald-50 text-emerald-600 border border-emerald-100 text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase">
                                    Devolvido
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </motion.div>
                )}

                {/* --- ABA 4: ADMIN GESTÃO DE ACERVO --- */}
                {abaAtiva === 'admin' && (perfilUsuario === 'Admin' || perfilUsuario === 'Colaborador') && (
                  <motion.div
                    key="admin-tab"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="grid grid-cols-1 md:grid-cols-3 gap-6"
                  >
                    
                    {/* Painel Esquerdo: Formulário Cadastro de Livro */}
                    <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs md:col-span-2">
                      <div className="flex justify-between items-center mb-6">
                        <div className="flex items-center gap-2">
                          <BookMarkdownIcon />
                          <h2 className="text-base font-extrabold text-[#9E519F]">Cadastrar Novo Acervo</h2>
                        </div>
                        <span className="text-[10px] bg-purple-50 text-purple-600 border border-purple-100 font-bold px-2 py-0.5 rounded uppercase">
                          Exclusivo Admin
                        </span>
                      </div>

                      <form onSubmit={handleCadastrarLivro} className="flex flex-col gap-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="md:col-span-2">
                            <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Título da Obra *</label>
                            <input 
                              type="text"
                              value={novoLivro.nome}
                              onChange={(e) => setNovoLivro({...novoLivro, nome: e.target.value})}
                              placeholder="Ex: Grande Sertão: Veredas"
                              maxLength={120}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-[#9E519F] focus:ring-1 focus:ring-[#9E519F] outline-none transition"
                              required
                            />
                          </div>

                          <div>
                            <div className="flex justify-between items-center mb-1">
                              <label className="block text-xs font-bold text-gray-400 uppercase">Autor *</label>
                              <button
                                type="button"
                                onClick={() => setMostrandoAddAutor(!mostrandoAddAutor)}
                                className="text-[11px] font-bold text-purple-600 hover:underline cursor-pointer"
                              >
                                {mostrandoAddAutor ? "Fechar" : "+ Criar Autor"}
                              </button>
                            </div>
                            
                            {!mostrandoAddAutor ? (
                              <select
                                value={novoLivro.autorId}
                                onChange={(e) => setNovoLivro({...novoLivro, autorId: e.target.value})}
                                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-xs bg-white focus:border-[#9E519F] outline-none"
                                required
                              >
                                <option value="">Selecione na base...</option>
                                {autores.map(a => (
                                  <option key={a.id} value={a.id}>{a.nome}</option>
                                ))}
                              </select>
                            ) : (
                              <div className="flex gap-1.5 items-center">
                                <input 
                                  type="text"
                                  value={novoAutorNome}
                                  onChange={(e) => setNovoAutorNome(e.target.value)}
                                  placeholder="Novo Autor"
                                  className="flex-1 px-2.5 py-2.5 border border-purple-300 bg-purple-50/20 rounded-lg text-xs outline-none"
                                />
                                <button
                                  type="button"
                                  onClick={handleCadastrarAutor}
                                  className="bg-[#9E519F] hover:bg-[#8d428e] text-white p-2.5 rounded-lg text-xs cursor-pointer"
                                  title="Confirmar novo autor"
                                >
                                  <Check size={14} />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                          <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Gênero Principal *</label>
                            <input 
                              type="text"
                              value={novoLivro.genero}
                              onChange={(e) => setNovoLivro({...novoLivro, genero: e.target.value})}
                              placeholder="Ex: Romance"
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-[#9E519F] outline-none"
                              required
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Ano de Lançamento *</label>
                            <input 
                              type="number"
                              value={novoLivro.ano}
                              onChange={(e) => setNovoLivro({...novoLivro, ano: e.target.value})}
                              placeholder="Ex: 1956"
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-[#9E519F] outline-none"
                              required
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Cód. Classificação CDD *</label>
                            <input 
                              type="number"
                              value={novoLivro.codigo}
                              onChange={(e) => setNovoLivro({...novoLivro, codigo: e.target.value})}
                              placeholder="Ex: 869"
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-[#9E519F] outline-none"
                              required
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Qtd em Estoque *</label>
                            <input 
                              type="number"
                              min="1"
                              value={novoLivro.quantidade}
                              onChange={(e) => setNovoLivro({...novoLivro, quantidade: parseInt(e.target.value) || 1})}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-[#9E519F] outline-none"
                              required
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Cor Temática no Acervo</label>
                          <div className="flex gap-2.5 items-center bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                            {[
                              { color: '#0082C6', label: 'Azul Fiotec' },
                              { color: '#9E519F', label: 'Roxo Fiotec' },
                              { color: '#70BF4A', label: 'Verde Fiotec' },
                              { color: '#F04A42', label: 'Vermelho Fiotec' },
                              { color: '#F1BD36', label: 'Amarelo Fiotec' },
                              { color: '#1f2937', label: 'Grafite' }
                            ].map(item => (
                              <button
                                key={item.color}
                                type="button"
                                onClick={() => setNovoLivro({...novoLivro, cor: item.color})}
                                style={{ backgroundColor: item.color }}
                                className={`w-7 h-7 rounded-full border-2 transition-transform cursor-pointer flex items-center justify-center ${
                                  novoLivro.cor === item.color ? 'border-white scale-115 ring-2 ring-purple-600' : 'border-transparent'
                                }`}
                                title={item.label}
                              >
                                {novoLivro.cor === item.color && <Check size={12} className="text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.5)]" />}
                              </button>
                            ))}
                            <span className="text-[10px] font-mono font-bold text-gray-400 ml-auto uppercase">Lombada Selecionada</span>
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Resumo / Detalhes de Catalogação *</label>
                          <textarea 
                            value={novoLivro.resumo}
                            onChange={(e) => setNovoLivro({...novoLivro, resumo: e.target.value})}
                            placeholder="Escreva um breve resumo contendo palavras-chave e tópicos cobertos neste exemplar para auxiliar consultas acadêmicas..."
                            maxLength={500}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm min-h-[90px] resize-y focus:border-[#9E519F] outline-none"
                            required
                          ></textarea>
                        </div>

                        <button
                          type="submit"
                          className="w-full bg-[#9E519F] hover:bg-[#864387] text-white font-bold py-3 px-4 rounded-xl text-sm transition mt-2 shadow-xs cursor-pointer flex justify-center items-center gap-2"
                        >
                          <Check size={16} />
                          <span>Salvar Registro no MySQL (Base Ativa)</span>
                        </button>
                      </form>
                    </div>

                    {/* Direções do MySQL e Lista Compacta de Exclusão */}
                    <div className="flex flex-col gap-6">
                      
                      {/* MySQL Quick Info card */}
                      <div className="bg-gradient-to-br from-[#0082C6] to-[#0293AF] text-white p-6 rounded-2xl border border-[#0082C6]/30 shadow-sm relative overflow-hidden">
                        <div className="absolute right-0 top-0 text-white/5 transform translate-x-4 -translate-y-4">
                          <Database size={150} />
                        </div>
                        
                        <div className="relative flex flex-col gap-2">
                          <h3 className="font-extrabold text-base flex items-center gap-2">
                            <Sparkles size={16} className="text-[#F1BD36] animate-spin" />
                            Ambiente MySQL Integrado
                          </h3>
                          <p className="text-xs text-slate-100 leading-relaxed">
                            A base relacional armazena de forma persistente os registros de acervos, categorias CDD, regras de empréstimos, e históricos de devolução dos leitores.
                          </p>
                          <div className="mt-2 text-[10px] font-mono bg-black/30 p-2.5 rounded-lg border border-white/20 flex flex-col gap-1">
                            <span>► DB: db_bibliotec</span>
                            <span>► ENGINE: InnoDB / Collation UTF8</span>
                            <span>► STATE: ONLINE</span>
                          </div>
                        </div>
                      </div>

                      {/* Lista de Controle de Exclusão Rápida */}
                      <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs flex-1">
                        <h3 className="text-xs font-bold text-gray-500 mb-4 uppercase tracking-wider">Ações Rápidas de Exclusão</h3>
                        <div className="flex flex-col gap-2.5 max-h-[280px] overflow-y-auto">
                          {livros.map(l => (
                            <div key={l.id} className="flex justify-between items-center gap-2 px-3 py-2 border border-gray-100 rounded-lg text-xs hover:bg-gray-50">
                              <div className="flex-1 min-w-0">
                                <p className="font-bold text-gray-800 truncate">{l.nome}</p>
                                <p className="text-gray-400 truncate">{l.autorNome || l.autor?.nome}</p>
                              </div>
                              <button 
                                onClick={() => handleExcluirLivro(l)}
                                className="p-1.5 text-red-500 hover:bg-red-50 rounded transition cursor-pointer"
                                title="Excluir livro permanentemente"
                              >
                                <Trash2 size={14} />
                              </button>
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

      {/* --- MODAL DETALHE DO LIVRO (CATÁLOGO REQUISIÇÃO) --- */}
      <AnimatePresence>
        {livroDetalhe && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-40"
          >
            <motion.div 
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-white rounded-2xl overflow-hidden shadow-2xl max-w-lg w-full border border-gray-200 relative flex flex-col"
            >
              <div style={{ backgroundColor: livroDetalhe.cor || '#0082C6' }} className="h-3 w-full" />
              
              <div className="p-6 md:p-8 flex flex-col gap-4">
                
                <div className="flex justify-between items-start gap-2">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider bg-gray-100 px-2 py-0.5 rounded border border-gray-200 w-max">
                      {livroDetalhe.genero}
                    </span>
                    <span className="text-xs text-gray-400 font-mono mt-1">Classificação CDD {livroDetalhe.codigo}</span>
                  </div>
                  <button 
                    onClick={() => setLivroDetalhe(null)} 
                    className="text-gray-400 hover:text-gray-600 text-lg font-bold p-1 cursor-pointer"
                  >
                    ✕
                  </button>
                </div>

                <div>
                  <h3 className="font-black text-xl text-gray-800">{livroDetalhe.nome}</h3>
                  <p className="text-sm text-gray-500 font-medium mt-1">
                    Autor: <span className="text-[#0082C6] font-bold">{livroDetalhe.autorNome || livroDetalhe.autor?.nome}</span>
                  </p>
                </div>

                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 flex flex-col gap-1.5">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Resumo do Catálogo</span>
                  <p className="text-xs text-gray-500 leading-relaxed max-h-32 overflow-y-auto pr-1">
                    {livroDetalhe.resumo || "Resumo não cadastrado no sistema."}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4 bg-gray-50/50 p-3.5 rounded-xl border border-gray-100/50 text-xs text-gray-500 font-semibold">
                  <div className="flex items-center gap-1.5">
                    <Calendar size={13} className="text-gray-400" />
                    <span>Ano Lançamento: {livroDetalhe.ano}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Layers size={13} className="text-gray-400" />
                    <span>Estoque: {livroDetalhe.quantidade} exemplares</span>
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-100 flex gap-3">
                  <button
                    onClick={() => setLivroDetalhe(null)}
                    className="flex-1 bg-gray-100 hover:bg-gray-200 transition font-bold py-2.5 px-4 rounded-xl text-xs text-gray-600 cursor-pointer"
                  >
                    Fechar Detalhes
                  </button>

                  <button
                    onClick={() => handleSolicitarEmprestimo(livroDetalhe)}
                    disabled={livroDetalhe.quantidade <= 0}
                    className={`flex-1 font-bold py-2.5 px-4 rounded-xl text-xs transition text-white shadow-xs cursor-pointer ${
                      livroDetalhe.quantidade > 0 ? 'bg-[#0082C6] hover:bg-[#0071ad]' : 'bg-gray-300 cursor-not-allowed'
                    }`}
                  >
                    {livroDetalhe.quantidade > 0 ? 'Confirmar Empréstimo' : 'Esgotado'}
                  </button>
                </div>

              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- PANEL LATERAL DE CONFIGURAÇÃO DE BARRAS/CONEXÕES (API CLIENT) --- */}
      <AnimatePresence>
        {showSettingsSidebar && (
          <>
            {/* Overlay */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSettingsSidebar(false)}
              className="fixed inset-0 bg-black/50 backdrop-blur-xs z-40"
            />
            {/* Sidebar */}
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25 }}
              className="fixed right-0 top-0 bottom-0 max-w-md w-full bg-[#16171d] text-white shadow-2xl z-50 p-6 flex flex-col justify-between border-l border-gray-800"
            >
              <div className="flex flex-col gap-6">
                
                {/* Header Sidebar */}
                <div className="flex justify-between items-center pb-4 border-b border-gray-800">
                  <div className="flex items-center gap-2">
                    <Sliders className="text-[#0082C6]" size={18} />
                    <h2 className="text-base font-bold text-gray-100">Configuração de Integração</h2>
                  </div>
                  <button 
                    onClick={() => setShowSettingsSidebar(false)}
                    className="text-gray-400 hover:text-white font-extrabold text-sm p-1.5 cursor-pointer"
                  >
                    ✕
                  </button>
                </div>

                {/* Switcher de Modo */}
                <div className="flex flex-col gap-3">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Fonte de Dados</h3>
                  <div className="grid grid-cols-2 gap-2 bg-black/40 p-1 rounded-xl border border-gray-800">
                    <button
                      onClick={() => setSettings({ ...settings, isMockMode: true })}
                      className={`py-2 px-3 text-xs font-bold rounded-lg transition cursor-pointer ${
                        settings.isMockMode 
                          ? 'bg-[#0082C6] text-white shadow-sm' 
                          : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      Demonstração
                    </button>
                    <button
                      onClick={() => setSettings({ ...settings, isMockMode: false })}
                      className={`py-2 px-3 text-xs font-bold rounded-lg transition cursor-pointer ${
                        !settings.isMockMode 
                          ? 'bg-[#0082C6] text-white shadow-sm' 
                          : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      API .NET Ativa
                    </button>
                  </div>
                  <p className="text-[11px] text-gray-500 leading-relaxed font-sans bg-black/20 p-3 rounded-lg border border-gray-900">
                    Use o modo <strong className="text-amber-400">Demonstração</strong> para testar as telas e interações direto no navegador com mock persistente. <strong className="text-sky-300">API .NET Ativa</strong> enviará requisições ao seu backend rodando localmente.
                  </p>
                </div>

                {/* Input do Endpoint */}
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">URL do Backend (.NET API)</label>
                  <div className="flex gap-2">
                    <input 
                      type="url"
                      value={settings.apiUrl}
                      onChange={(e) => setSettings({ ...settings, apiUrl: e.target.value })}
                      placeholder="https://localhost:7172/api"
                      disabled={settings.isMockMode}
                      className="flex-1 bg-black/40 border border-gray-800 focus:border-[#0082C6] rounded-xl px-3.5 py-2.5 text-xs text-white font-mono outline-none outline-offset-0 disabled:opacity-40"
                    />
                    <button
                      onClick={testarConexaoApi}
                      disabled={settings.isMockMode || testConnectionStatus === 'testing'}
                      className="px-3 py-2 bg-gray-800 border border-gray-700 hover:bg-gray-700 active:bg-gray-950 font-bold rounded-xl text-xs text-gray-300 transition shrink-0 disabled:opacity-30 cursor-pointer"
                    >
                      {testConnectionStatus === 'testing' ? 'Pingando...' : 'Testar Conexão'}
                    </button>
                  </div>

                  {/* Status Connection Pill */}
                  {testConnectionStatus === 'success' && (
                    <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20 w-max mt-1">
                      ● API ONLINE E RESPONDENDO
                    </span>
                  )}
                  {testConnectionStatus === 'failed' && (
                    <span className="text-[10px] font-mono font-bold text-red-400 bg-red-500/10 px-3 py-1.5 rounded-lg border border-red-500/20 w-max mt-1">
                      ● API OFFLINE OU CERTIFICADO INVÁLIDO
                    </span>
                  )}
                </div>

                {/* Console Log de Eventos integrados */}
                <div className="flex flex-col gap-2 flex-1">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Dev Terminal Logs</span>
                    <button 
                      onClick={() => setLogs([])}
                      className="text-[10px] text-gray-500 hover:text-white"
                    >
                      Limpar Logs
                    </button>
                  </div>
                  <div className="bg-black border border-gray-800 p-3.5 rounded-xl font-mono text-[10px] h-44 overflow-y-auto text-emerald-400 flex flex-col gap-1.5 leading-relaxed">
                    {logs.length === 0 ? (
                      <span className="text-gray-600">Aguardando gatilhos e conexões no sistema...</span>
                    ) : (
                      logs.map((log, i) => <div key={i} className="truncate">{log}</div>)
                    )}
                  </div>
                </div>

              </div>

              {/* Footer Sidebar */}
              <div className="border-t border-gray-800 pt-4 mt-6 text-[10px] text-gray-500 text-center flex flex-col gap-2">
                <span>Biblioteca Fiotec v3.1 • Base Relacional MySQL integrado</span>
                <span className="text-white/40 block">Pressione ✕ ou finalize para voltar</span>
              </div>

            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* --- SITE FOOTER --- */}
      <footer className="bg-white border-t border-gray-200 py-6 px-10 text-center text-xs text-gray-400 font-semibold mt-auto z-10 flex flex-col sm:flex-row justify-between items-center gap-4">
        <p className="flex items-center gap-1.5">
          <span>Bibliotec Fiotec © {new Date().getFullYear()}</span>
          <span>•</span>
          <span className="bg-blue-50 text-[#0082C6] px-2 py-0.5 rounded text-[10px]">Portal de Leitura Privada</span>
        </p>
        <span className="font-mono text-[11px] text-gray-400 hidden sm:inline">
          MySQL Sincronizado • Atendimento de Matrículas Ativas
        </span>
      </footer>

    </div>
  );
}

// Pequeno ícone componente local para evitar dependência externa que quebre
function BookMarkdownIcon() {
  return (
    <div className="p-1 px-2 rounded bg-purple-50 border border-purple-100 text-purple-700">
      <Database size={14} />
    </div>
  );
}
