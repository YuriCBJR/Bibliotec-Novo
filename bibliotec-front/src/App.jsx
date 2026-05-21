import React, { useState, useEffect } from 'react';
import { useMsal, AuthenticatedTemplate, UnauthenticatedTemplate } from '@azure/msal-react';
import { InteractionStatus } from '@azure/msal-browser';
import { loginRequest } from './authConfig';
import axios from 'axios';

const API_URL = "https://localhost:7172/api";

function App() {
    const { instance, accounts, inProgress } = useMsal();

    // ESTADOS DO SISTEMA
    const [livros, setLivros] = useState([]);
    const [autores, setAutores] = useState([]);
    const [carregando, setCarregando] = useState(false);
    const [perfilUsuario, setPerfilUsuario] = useState('');
    const [abaAtiva, setAbaAtiva] = useState('catalogo');

    // 🔑 ESTADOS DO LOGIN TRADICIONAL (FORMULÁRIO)
    const [emailForm, setEmailForm] = useState('');
    const [senhaForm, setSenhaForm] = useState('');
    const [carregandoLoginComum, setCarregandoLoginComum] = useState(false);

    // ESTADOS DOS FILTROS E CADASTRO
    const [busca, setBusca] = useState('');
    const [apenasDisponiveis, setApenasDisponiveis] = useState(false);
    const [autorSelecionado, setAutorSelecionado] = useState('');
    const [novoLivro, setNovoLivro] = useState({ nome: '', genero:'', disponivel: true, autorId: '' });

    // 1️⃣ FLUXO: LOGIN TRADICIONAL (Formulário)
    const handleLoginTradicional = async (e) => {
        e.preventDefault();
        if (!emailForm || !senhaForm) {
            alert("Por favor, preencha o e-mail e a senha.");
            return;
        }

        setCarregandoLoginComum(true);
        try {
            // Bate no endpoint comum de login da sua API C#
            const response = await axios.post(`${API_URL}/autenticacao/login`, {
                email: emailForm,
                password: senhaForm
            });

            const { token, usuario } = response.data;

            // Salva as credenciais locais geradas pelo seu JWT
            localStorage.setItem("token_biblioteca", token);
            localStorage.setItem("perfil_biblioteca", usuario.permissao);
            localStorage.setItem("nome_usuario_comum", usuario.nome); // Guarda o nome para exibir no header

            setPerfilUsuario(usuario.permissao);

            // Carrega os dados do sistema
            carregarLivros();
            carregarAutores();

            alert(`Bem-vindo, ${usuario.nome}! Logado como ${usuario.permissao}.`);
        } catch (error) {
            console.error("Erro no login tradicional:", error);
            alert(error.response?.data?.mensagem || "E-mail ou senha incorretos.");
        } finally {
            setCarregandoLoginComum(false);
        }
    };

    // 2️⃣ FLUXO: LOGIN MICROSOFT (Redirect)
    const handleLoginMicrosoft = async () => {
        if (inProgress !== InteractionStatus.None) return;
        try { await instance.loginRedirect(loginRequest); } catch (e) { console.error(e); }
    };

    useEffect(() => {
        const enviarTokenParaApi = async () => {
            if (inProgress === InteractionStatus.None && accounts.length > 0) {
                try {
                    const responseAzure = await instance.acquireTokenSilent({ ...loginRequest, account: accounts[0] });
                    const tokenAzure = responseAzure.accessToken;

                    const responseApi = await axios.post(`${API_URL}/autenticacao/login-azure`, {}, {
                        headers: { 'Authorization': `Bearer ${tokenAzure}` }
                    });

                    const { token, usuario } = responseApi.data;
                    localStorage.setItem("token_biblioteca", token);
                    localStorage.setItem("perfil_biblioteca", usuario.permissao);
                    setPerfilUsuario(usuario.permissao);

                    carregarLivros();
                    carregarAutores();
                } catch (error) { console.error(error); }
            }
        };
        enviarTokenParaApi();
    }, [inProgress, accounts]);

    // Recupera sessão se der F5 (funciona para Microsoft e para Login Comum)
    useEffect(() => {
        const tokenSalvo = localStorage.getItem("token_biblioteca");
        const perfilSalvo = localStorage.getItem("perfil_biblioteca");
        if (tokenSalvo && perfilSalvo) {
            setPerfilUsuario(perfilSalvo);
            carregarLivros();
            carregarAutores();
        }
    }, [accounts]);

    // Captura o nome correto para exibir no Header (Microsoft ou Form comum)
    const obterNomeUsuario = () => {
        if (accounts.length > 0) return accounts[0].name;
        return localStorage.getItem("nome_usuario_comum") || "Usuário";
    };

    // Métodos de integração com a API (.NET)
    const carregarLivros = async (filtrarDisponivel = apenasDisponiveis, idAutor = autorSelecionado) => {
        setCarregando(true);
        try {
            const tokenSistema = localStorage.getItem("token_biblioteca");
            let url = `${API_URL}/livro`;
            if (idAutor) url = `${API_URL}/livro/${idAutor}/livros`;
            else if (filtrarDisponivel) url = `${API_URL}/livro/disponiveis?disponivel=true`;

            const response = await axios.get(url, { headers: { 'Authorization': `Bearer ${tokenSistema}` } });
            setLivros(response.data);
        } catch (e) { console.error(e); } finally { setCarregando(false); }
    };

    const carregarAutores = async () => {
        try {
            const response = await axios.get(`${API_URL}/autor`);
            setAutores(response.data);
        } catch (e) { console.error(e); }
    };

    const handleCadastrarLivro = async (e) => {
        e.preventDefault();
        try {
            const tokenSistema = localStorage.getItem("token_biblioteca");
            await axios.post(`${API_URL}/livro`, novoLivro, { headers: { 'Authorization': `Bearer ${tokenSistema}` } });
            alert("Livro cadastrado!");
            setNovoLivro({ nome: '', genero: '', autorId: '', disponivel: "true"});
            carregarLivros();
        } catch (e) { alert("Erro ao cadastrar." + e.Message); }
    };

    const handleDeletarLivro = async (id, nome) => {
        if (!window.confirm(`Excluir permanentemente "${nome}"?`)) return;
        try {
            const tokenSistema = localStorage.getItem("token_biblioteca");
            await axios.delete(`${API_URL}/livro/${id}`, { headers: { 'Authorization': `Bearer ${tokenSistema}` } });
            carregarLivros();
        } catch (e) { alert("Erro ao deletar."); }
    };

    const handleSolicitarEmprestimo = async (livroId) => {
        if (!window.confirm(`Solicitar empréstimo?`)) return;
        try {
            const tokenSistema = localStorage.getItem("token_biblioteca");
            const payloadEmprestimo = {
                livroId: livroId,
                dataEmprestimo: new Date().toISOString(),
                usuarioId: "00000000-0000-0000-0000-000000000000"
            };
            await axios.post(`${API_URL}/Emprestimo`, payloadEmprestimo, { headers: { 'Authorization': `Bearer ${tokenSistema}` } });
            alert("Solicitado!");
            carregarLivros();
        } catch (e) { alert("Erro ao solicitar."); }
    };

    const livrosFiltrados = livros.filter(l =>
        l && l.nome && typeof l.nome === 'string' ? l.nome.toLowerCase().includes(busca.toLowerCase()) : false
    );

    // Validação manual para esconder o painel caso o login tradicional tenha sido feito por um Leitor
    const estaAutenticado = accounts.length > 0 || localStorage.getItem("token_biblioteca") !== null;

    return (
        <div style={{ padding: '20px', fontFamily: 'Segoe UI, sans-serif', backgroundColor: '#f5f5f5', minHeight: '100vh' }}>

            {/* HEADER */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', padding: '15px 30px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                <h2 style={{ margin: 0, color: '#0078d4' }}>📚 Bibliotec | Corporativo</h2>
                {estaAutenticado && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                        <span>Olá, <strong>{obterNomeUsuario()}</strong> ({perfilUsuario})</span>
                        <button onClick={() => { instance.logoutRedirect(); localStorage.clear(); window.location.reload(); }} style={{ padding: '6px 12px', backgroundColor: '#a80000', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Sair</button>
                    </div>
                )}
            </div>

            {/* 🔒 TELA DESLOGADO: FORMULÁRIO TRADICIONAL + ENTRAR COM MICROSOFT */}
            {!estaAutenticado && (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'stretch', gap: '40px', marginTop: '60px', maxWidth: '900px', margin: '60px auto 0 auto' }}>

                    {/* LADO ESQUERDO: Formulário Normal */}
                    <div style={{ flex: 1, backgroundColor: '#fff', padding: '30px', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column' }}>
                        <h3 style={{ marginTop: 0, color: '#323130', marginBottom: '20px' }}>Acesso Local</h3>

                        <form onSubmit={handleLoginTradicional} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '14px', marginBottom: '5px', color: '#494541' }}>E-mail</label>
                                <input
                                    type="email"
                                    value={emailForm}
                                    onChange={(e) => setEmailForm(e.target.value)}
                                    placeholder="usuario@email.com"
                                    style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #ced4da', boxSizing: 'border-box' }}
                                    required
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '14px', marginBottom: '5px', color: '#494541' }}>Senha</label>
                                <input
                                    type="password"
                                    value={senhaForm}
                                    onChange={(e) => setSenhaForm(e.target.value)}
                                    placeholder="••••••••"
                                    style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #ced4da', boxSizing: 'border-box' }}
                                    required
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={carregandoLoginComum}
                                style={{ width: '100%', padding: '12px', backgroundColor: '#2b2b2b', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: carregandoLoginComum ? 'not-allowed' : 'pointer', marginTop: '10px' }}
                            >
                                {carregandoLoginComum ? "⏳ Verificando..." : "Entrar no Sistema"}
                            </button>
                        </form>
                    </div>

                    {/* DIVISOR VISUAL */}
                    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                        <div style={{ width: '1px', backgroundColor: '#ced4da', flex: 1 }}></div>
                        <span style={{ padding: '10px 0', color: '#605e5c', fontSize: '13px', fontWeight: 'bold' }}>OU</span>
                        <div style={{ width: '1px', backgroundColor: '#ced4da', flex: 1 }}></div>
                    </div>

                    {/* LADO DIREITO: SSO Microsoft */}
                    <div style={{ flex: 1, backgroundColor: '#fff', padding: '30px', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
                        <h3 style={{ marginTop: 0, color: '#323130' }}>Acesso Corporativo</h3>
                        <p style={{ color: '#605e5c', fontSize: '14px', marginBottom: '25px' }}>Se você faz parte do time da Fiotec, utilize o botão abaixo para logar direto com sua conta Office 365.</p>

                        <button
                            onClick={handleLoginMicrosoft}
                            style={{ padding: '12px 24px', backgroundColor: '#0078d4', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '10px', transition: 'background-color 0.2s' }}
                        >
                            🔷 Entrar com a Microsoft
                        </button>
                    </div>

                </div>
            )}

            {/* 🔓 TELA LOGADO: PAINEL DE ABAS (CATÁLOGO / ADMIN) */}
            {estaAutenticado && (
                <div style={{ marginTop: '30px' }}>

                    {perfilUsuario === 'Admin' && (
                        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                            <button onClick={() => setAbaAtiva('catalogo')} style={{ padding: '10px 20px', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', backgroundColor: abaAtiva === 'catalogo' ? '#0078d4' : '#e1dfdd', color: abaAtiva === 'catalogo' ? 'white' : 'black' }}>
                                📖 Catálogo Geral
                            </button>
                            <button onClick={() => setAbaAtiva('admin')} style={{ padding: '10px 20px', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', backgroundColor: abaAtiva === 'admin' ? '#107c41' : '#e1dfdd', color: abaAtiva === 'admin' ? 'white' : 'black' }}>
                                ⚙️ Painel de Administração
                            </button>
                        </div>
                    )}

                    {/* ABA: CATÁLOGO */}
                    {abaAtiva === 'catalogo' && (
                        <div>
                            <div style={{ display: 'flex', gap: '15px', marginBottom: '20px' }}>
                                <input type="text" placeholder="🔍 Buscar por nome..." value={busca} onChange={(e) => setBusca(e.target.value)} style={{ flex: 1, padding: '10px', borderRadius: '4px', border: '1px solid #ced4da' }} />
                            </div>

                            <h3>📖 Acervo da Biblioteca</h3>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
                                {livrosFiltrados.map((livro) => (
                                    <div key={livro.id} style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                                        <div>
                                            <h4 style={{ margin: '0 0 8px 0', fontSize: '18px' }}>{livro.nome}</h4>
                                            <p style={{ margin: '0 0 15px 0', fontSize: '14px', color: '#605e5c' }}>Autor: {livro.autorNome || livro.autor?.nome || 'Desconhecido'}</p>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <button onClick={() => handleSolicitarEmprestimo(livro.id, livro.nome)} disabled={livro.quantidade <= 0} style={{ padding: '8px 14px', backgroundColor: livro.quantidade > 0 ? '#0078d4' : '#ced4da', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Solicitar</button>
                                            {perfilUsuario === 'Admin' && (
                                                <button onClick={() => handleDeletarLivro(livro.id, livro.nome)} style={{ backgroundColor: 'transparent', border: 'none', color: '#a80000', cursor: 'pointer' }}>🗑️</button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* ABA: PAINEL ADMIN */}
                    {abaAtiva === 'admin' && perfilUsuario === 'Admin' && (
                        <div>
                            {/* Cadastro de Livro */}
                            <div style={{ backgroundColor: '#fff', padding: '25px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', marginBottom: '30px' }}>
                                <h3 style={{ marginTop: 0, color: '#107c41' }}>➕ Adicionar Novo Livro</h3>
                                <form onSubmit={handleCadastrarLivro} style={{ display: 'flex', gap: '15px', alignItems: 'flex-end', flexWrap: 'wrap' }}>

                                    {/* Input: Nome */}
                                    <div style={{ flex: 2, minWidth: '200px' }}>
                                        <label style={{ display: 'block', fontSize: '13px', marginBottom: '5px' }}>Nome do Livro</label>
                                        <input
                                            type="text"
                                            placeholder="Ex: C# Advanced"
                                            value={novoLivro.nome}
                                            onChange={(e) => setNovoLivro({ ...novoLivro, nome: e.target.value })}
                                            style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ced4da', boxSizing: 'border-box' }}
                                            required
                                        />
                                    </div>

                                    {/* Select: Autor */}
                                    <div style={{ flex: 1, minWidth: '150px' }}>
                                        <label style={{ display: 'block', fontSize: '13px', marginBottom: '5px' }}>Autor</label>
                                        <select
                                            value={novoLivro.autorId}
                                            onChange={(e) => setNovoLivro({ ...novoLivro, autorId: e.target.value })}
                                            style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ced4da', boxSizing: 'border-box' }}
                                            required
                                        >
                                            <option value="">Selecione...</option>
                                            {autores.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
                                        </select>
                                    </div>

                                    {/* Input: Gênero (Substituiu a Categoria) */}
                                    <div style={{ flex: 1, minWidth: '150px' }}>
                                        <label style={{ display: 'block', fontSize: '13px', marginBottom: '5px' }}>Gênero</label>
                                        <input
                                            type="text"
                                            placeholder="Ex: Tecnologia"
                                            value={novoLivro.genero}
                                            onChange={(e) => setNovoLivro({ ...novoLivro, genero: e.target.value })}
                                            style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ced4da', boxSizing: 'border-box' }}
                                            required
                                        />
                                    </div>

                                    {/* Botão Salvar */}
                                    <button
                                        type="submit"
                                        style={{ padding: '9px 20px', backgroundColor: '#107c41', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', height: '36px' }}
                                    >
                                        Salvar no Banco
                                    </button>
                                </form>
                            </div>
                        </div>
                    )}

                </div>
            )}

        </div>
    );
}

export default App;