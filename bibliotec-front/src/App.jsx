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
    const [emprestimos, setEmprestimos] = useState([]); // 🟢 NOVO: Guarda os empréstimos do usuário
    const [carregando, setCarregando] = useState(false);
    const [perfilUsuario, setPerfilUsuario] = useState('');
    const [abaAtiva, setAbaAtiva] = useState('catalogo'); // 'catalogo', 'meus-emprestimos', 'admin'

    // ESTADOS DO LOGIN TRADICIONAL
    const [emailForm, setEmailForm] = useState('');
    const [senhaForm, setSenhaForm] = useState('');
    const [carregandoLoginComum, setCarregandoLoginComum] = useState(false);

    // ESTADOS DOS FILTROS
    const [busca, setBusca] = useState('');
    const [apenasDisponiveis, setApenasDisponiveis] = useState(false);
    const [autorSelecionado, setAutorSelecionado] = useState('');

    // ESTADO DE CADASTRO DE LIVRO
    const [novoLivro, setNovoLivro] = useState({ nome: '', autorId: '', disponivel: true, genero: '' });

    // 1️⃣ FLUXO: LOGIN TRADICIONAL
    const handleLoginTradicional = async (e) => {
        e.preventDefault();
        if (!emailForm || !senhaForm) {
            alert("Por favor, preencha o e-mail e a senha.");
            return;
        }
        setCarregandoLoginComum(true);
        try {
            const response = await axios.post(`${API_URL}/autenticacao/login`, { email: emailForm, password: senhaForm });
            const { token, usuario } = response.data;

            localStorage.setItem("token_biblioteca", token);
            localStorage.setItem("perfil_biblioteca", usuario.permissao);
            localStorage.setItem("nome_usuario_comum", usuario.nome);
            setPerfilUsuario(usuario.permissao);

            carregarDadosIniciais();
            alert(`Bem-vindo, ${usuario.nome}!`);
        } catch (error) {
            alert(error.response?.data?.mensagem || "E-mail ou senha incorretos.");
        } finally { setCarregandoLoginComum(false); }
    };

    // 2️⃣ FLUXO: LOGIN MICROSOFT
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

                    carregarDadosIniciais();
                } catch (error) { console.error(error); }
            }
        };
        enviarTokenParaApi();
    }, [inProgress, accounts]);

    // Recupera sessão ao dar F5
    useEffect(() => {
        const tokenSalvo = localStorage.getItem("token_biblioteca");
        const perfilSalvo = localStorage.getItem("perfil_biblioteca");
        if (tokenSalvo && perfilSalvo) {
            setPerfilUsuario(perfilSalvo);
            carregarDadosIniciais();
        }
    }, [accounts]);

    const carregarDadosIniciais = () => {
        carregarLivros(apenasDisponiveis, autorSelecionado);
        carregarAutores();
        carregarMeusEmprestimos(); // 🟢 Carrega os empréstimos do usuário logado
    };

    // INTEGRATION: OBTER LIVROS
    const carregarLivros = async (filtrarDisponivel, idAutor) => {
        setCarregando(true);
        try {
            const tokenSistema = localStorage.getItem("token_biblioteca");
            const headers = { 'Authorization': `Bearer ${tokenSistema}` };
            let url = `${API_URL}/livro`;

            if (idAutor) url = `${API_URL}/livro/${idAutor}/livros`;
            else if (filtrarDisponivel) url = `${API_URL}/livro/disponiveis?disponivel=true`;

            const response = await axios.get(url, { headers });
            setLivros(response.data);
        } catch (e) { console.error(e); } finally { setCarregando(false); }
    };

    const carregarAutores = async () => {
        try {
            const response = await axios.get(`${API_URL}/autor`);
            setAutores(response.data);
        } catch (e) { console.error(e); }
    };

    // 🟢 NOVO ENDPOINT: COLETAR EMPRÉSTIMOS DO USUÁRIO LOGADO
    const carregarMeusEmprestimos = async () => {
        try {
            const tokenSistema = localStorage.getItem("token_biblioteca");
            // Bate no endpoint protegido que lê o token e traz os dados do MySQL
            const response = await axios.get(`${API_URL}/Emprestimo/meus-emprestimos`, {
                headers: { 'Authorization': `Bearer ${tokenSistema}` }
            });
            setEmprestimos(response.data);
        } catch (error) {
            console.error("Erro ao carregar empréstimos:", error);
        }
    };

    // FILTROS
    const handleCheckboxChange = (e) => {
        const valor = e.target.checked;
        setApenasDisponiveis(valor); setAutorSelecionado('');
        carregarLivros(valor, '');
    };

    const handleAutorChange = (e) => {
        const id = e.target.value;
        setAutorSelecionado(id); setApenasDisponiveis(false);
        carregarLivros(false, id);
    };

    const handleLimparFiltros = () => {
        setApenasDisponiveis(false); setAutorSelecionado(''); setBusca('');
        carregarLivros(false, '');
    };

    // REQUISIÇÃO: SOLICITAR EMPRÉSTIMO
    const handleSolicitarEmprestimo = async (livroId, livroNome) => {
        if (!window.confirm(`Deseja solicitar o empréstimo de "${livroNome}"?`)) return;
        try {
            const tokenSistema = localStorage.getItem("token_biblioteca");
            const payloadEmprestimo = { libroId: livroId, dataEmprestimo: new Date().toISOString() };

            await axios.post(`${API_URL}/Emprestimo`, payloadEmprestimo, {
                headers: { 'Authorization': `Bearer ${tokenSistema}` }
            });

            alert("Empréstimo registrado com sucesso!");
            carregarDadosIniciais(); // Recarrega os livros e a nova lista de empréstimos
        } catch (error) {
            alert(error.response?.data?.mensagem || "Falha ao processar empréstimo.");
        }
    };

    // 🟢 REQUISIÇÃO: DEVOLVER LIVRO
    const handleDevolverLivro = async (emprestimoId) => {
        if (!window.confirm("Confirmar a devolução deste livro à biblioteca da TI?")) return;
        try {
            const tokenSistema = localStorage.getItem("token_biblioteca");

            // Bate no endpoint de devolução passando o ID do registro de empréstimo
            await axios.post(`${API_URL}/Emprestimo/devolver/${emprestimoId}`, {}, {
                headers: { 'Authorization': `Bearer ${tokenSistema}` }
            });

            alert("Livro devolvido com sucesso! Obrigado.");
            carregarDadosIniciais(); // Atualiza o estoque e os status na tela
        } catch (error) {
            console.error(error);
            alert("Erro ao processar devolução na API.");
        }
    };

    // ACTIONS ADMIN
    const handleCadastrarLivro = async (e) => {
        e.preventDefault();
        try {
            const tokenSistema = localStorage.getItem("token_biblioteca");
            await axios.post(`${API_URL}/livro`, novoLivro, { headers: { 'Authorization': `Bearer ${tokenSistema}` } });
            alert("Livro adicionado!");
            setNovoLivro({ nome: '', autorId: '', disponivel: true, genero: '' });
            carregarLivros(apenasDisponiveis, autorSelecionado);
        } catch (e) { alert("Erro ao cadastrar."); }
    };

    const handleDeletarLivro = async (id, nome) => {
        if (!window.confirm(`Excluir permanentemente "${nome}"?`)) return;
        try {
            const tokenSistema = localStorage.getItem("token_biblioteca");
            await axios.delete(`${API_URL}/livro/${id}`, { headers: { 'Authorization': `Bearer ${tokenSistema}` } });
            carregarLivros(apenasDisponiveis, autorSelecionado);
        } catch (e) { alert("Erro ao deletar."); }
    };

    const obterNomeUsuario = () => {
        if (accounts.length > 0) return accounts[0].name;
        return localStorage.getItem("nome_usuario_comum") || "Usuário";
    };

    const livrosFiltrados = livros.filter(l =>
        l && l.nome && typeof l.nome === 'string' ? l.nome.toLowerCase().includes(busca.toLowerCase()) : false
    );

    const estaAutenticado = accounts.length > 0 || localStorage.getItem("token_biblioteca") !== null;

    return (
        <div style={{ padding: '20px', fontFamily: 'Segoe UI, sans-serif', backgroundColor: '#f5f5f5', minHeight: '100vh' }}>

            {/* HEADER */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', padding: '15px 30px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                <h2 style={{ margin: 0, color: '#0078d4' }}>📚 Bibliotec Fiotec</h2>
                {estaAutenticado && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                        <span>Olá, <strong>{obterNomeUsuario()}</strong> (<small>{perfilUsuario}</small>)</span>
                        <button onClick={() => { instance.logoutRedirect(); localStorage.clear(); window.location.reload(); }} style={{ padding: '6px 12px', backgroundColor: '#a80000', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Sair</button>
                    </div>
                )}
            </div>

            {/* 🔒 DESLOGADO */}
            {!estaAutenticado && (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'stretch', gap: '40px', marginTop: '60px', maxWidth: '900px', margin: '60px auto 0 auto' }}>
                    <div style={{ flex: 1, backgroundColor: '#fff', padding: '30px', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                        <h3 style={{ marginTop: 0, color: '#323130', marginBottom: '20px' }}>Acesso Local</h3>
                        <form onSubmit={handleLoginTradicional} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                            <input type="email" value={emailForm} onChange={(e) => setEmailForm(e.target.value)} placeholder="usuario@fiotec.com" style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #ced4da', boxSizing: 'border-box' }} required />
                            <input type="password" value={senhaForm} onChange={(e) => setSenhaForm(e.target.value)} placeholder="••••••••" style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #ced4da', boxSizing: 'border-box' }} required />
                            <button type="submit" disabled={carregandoLoginComum} style={{ width: '100%', padding: '12px', backgroundColor: '#2b2b2b', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>Entrar</button>
                        </form>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}><span style={{ color: '#605e5c', fontSize: '13px', fontWeight: 'bold' }}>OU</span></div>
                    <div style={{ flex: 1, backgroundColor: '#fff', padding: '30px', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                        <h3 style={{ marginTop: 0, color: '#323130' }}>Acesso Corporativo</h3>
                        <button onClick={handleLoginMicrosoft} style={{ padding: '12px 24px', backgroundColor: '#0078d4', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold' }}>🔷 Conectar via Microsoft</button>
                    </div>
                </div>
            )}

            {/* 🔓 LOGADO */}
            {estaAutenticado && (
                <div style={{ marginTop: '30px' }}>

                    {/* MENU DE NAVEGAÇÃO POR ABAS (Aparece para todos, mas Admin ganha a aba extra) */}
                    <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', borderBottom: '2px solid #e1dfdd', paddingBottom: '10px' }}>
                        <button onClick={() => setAbaAtiva('catalogo')} style={{ padding: '10px 20px', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', backgroundColor: abaAtiva === 'catalogo' ? '#0078d4' : 'transparent', color: abaAtiva === 'catalogo' ? 'white' : 'black' }}>
                            📖 Ver Acervo
                        </button>

                        <button onClick={() => setAbaAtiva('meus-emprestimos')} style={{ padding: '10px 20px', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', backgroundColor: abaAtiva === 'meus-emprestimos' ? '#0078d4' : 'transparent', color: abaAtiva === 'meus-emprestimos' ? 'white' : 'black' }}>
                            🕒 Meus Empréstimos ({emprestimos.length})
                        </button>

                        {perfilUsuario === 'Admin' && (
                            <button onClick={() => setAbaAtiva('admin')} style={{ padding: '10px 20px', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', backgroundColor: abaAtiva === 'admin' ? '#107c41' : 'transparent', color: abaAtiva === 'admin' ? 'white' : 'black', marginLeft: 'auto' }}>
                                ⚙️ Painel do Admin
                            </button>
                        )}
                    </div>

                    {/* ---------------- ABA 1: CATÁLOGO GERAL ---------------- */}
                    {abaAtiva === 'catalogo' && (
                        <div>
                            <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '8px', marginBottom: '20px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                                <div style={{ display: 'flex', gap: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
                                    <input type="text" placeholder="Pesquisar por palavra-chave..." value={busca} onChange={(e) => setBusca(e.target.value)} style={{ flex: 2, padding: '8px 12px', borderRadius: '4px', border: '1px solid #ced4da' }} />
                                    <select value={autorSelecionado} onChange={handleAutorChange} style={{ flex: 1, padding: '8px 12px', borderRadius: '4px', border: '1px solid #ced4da' }}>
                                        <option value="">Filtrar por Autor...</option>
                                        {autores.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
                                    </select>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold' }}>
                                        <input type="checkbox" checked={apenasDisponiveis} onChange={handleCheckboxChange} /> Apenas Disponíveis
                                    </label>
                                    <button onClick={handleLimparFiltros} style={{ padding: '8px 16px', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Limpar</button>
                                </div>
                            </div>

                            <h3>📖 Livros Cadastrados</h3>
                            {carregando ? <p>⏳ Consultando base...</p> : (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
                                    {livrosFiltrados.map((livro) => (
                                        <div key={livro.id} style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                                            <div>
                                                <h4 style={{ margin: '0 0 8px 0', fontSize: '18px' }}>{livro.nome}</h4>
                                                <p style={{ margin: '0 0 6px 0', fontSize: '14px', color: '#605e5c' }}>Autor: {livro.autorNome || livro.autor?.nome || 'Desconhecido'}</p>
                                                <p style={{ margin: '0 0 15px 0', fontSize: '13px', color: '#a19f9d' }}>Gênero: {livro.genero || 'Geral'}</p>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f3f2f1', paddingTop: '15px' }}>
                                                <span style={{ fontSize: '13px', color: livro.disponivel ? '#107c41' : '#a80000', fontWeight: 'bold' }}>{livro.disponivel ? '🟢 Disponível' : '🔴 Emprestado'}</span>
                                                <div style={{ display: 'flex', gap: '10px' }}>
                                                    <button onClick={() => handleSolicitarEmprestimo(livro.id, livro.nome)} disabled={!livro.disponivel} style={{ padding: '8px 14px', backgroundColor: livro.disponivel ? '#0078d4' : '#ced4da', color: 'white', border: 'none', borderRadius: '4px', cursor: livro.disponivel ? 'pointer' : 'not-allowed', fontWeight: 'bold' }}>Solicitar</button>
                                                    {perfilUsuario === 'Admin' && <button onClick={() => handleDeletarLivro(livro.id, livro.nome)} style={{ backgroundColor: 'transparent', border: 'none', color: '#a80000', cursor: 'pointer' }}>🗑️</button>}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ---------------- 🟢 ABA 2: HISTÓRICO DE EMPRÉSTIMOS DO USUÁRIO ---------------- */}
                    {abaAtiva === 'meus-emprestimos' && (
                        <div style={{ backgroundColor: '#fff', padding: '25px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                            <h3 style={{ marginTop: 0, color: '#0078d4' }}>🕒 Meus Livros Solicitados</h3>
                            <p style={{ color: '#605e5c', fontSize: '14px' }}>Aqui você acompanha os livros que estão em sua posse e pode realizar a devolução.</p>

                            {emprestimos.length === 0 ? (
                                <p style={{ marginTop: '20px', color: '#a19f9d', fontStyle: 'italic' }}>Você não possui nenhum empréstimo ativo no momento.</p>
                            ) : (
                                <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '20px' }}>
                                    <thead>
                                        <tr style={{ backgroundColor: '#f3f2f1', textAlign: 'left' }}>
                                            <th style={{ padding: '12px' }}>Livro</th>
                                            <th style={{ padding: '12px' }}>Data de Solicitação</th>
                                            <th style={{ padding: '12px' }}>Status</th>
                                            <th style={{ padding: '12px', textAlign: 'right' }}>Ação</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {emprestimos.map((emp) => (
                                            <tr key={emp.id} style={{ borderBottom: '1px solid #f3f2f1' }}>
                                                <td style={{ padding: '12px', fontWeight: 'bold' }}>{emp.livroNome || emp.livro?.nome || "Livro Solicitado"}</td>
                                                <td style={{ padding: '12px' }}>{new Date(emp.dataEmprestimo).toLocaleDateString('pt-BR')}</td>
                                                <td style={{ padding: '12px' }}>
                                                    <span style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold', backgroundColor: emp.status === 'Devolvido' ? '#dff6dd' : '#fff4ce', color: emp.status === 'Devolvido' ? '#107c41' : '#795600' }}>
                                                        {emp.status || 'Ativo'}
                                                    </span>
                                                </td>
                                                <td style={{ padding: '12px', textAlign: 'right' }}>
                                                    {emp.status !== 'Devolvido' && (
                                                        <button
                                                            onClick={() => handleDevolverLivro(emp.id)}
                                                            style={{ padding: '6px 12px', backgroundColor: '#107c41', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px' }}
                                                        >
                                                            ↩️ Devolver Livro
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    )}

                    {/* ---------------- ABA 3: PAINEL ADMIN ---------------- */}
                    {abaAtiva === 'admin' && perfilUsuario === 'Admin' && (
                        <div>
                            <div style={{ backgroundColor: '#fff', padding: '25px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                                <h3 style={{ marginTop: 0, color: '#107c41' }}>➕ Adicionar Novo Livro ao Acervo</h3>
                                <form onSubmit={handleCadastrarLivro} style={{ display: 'flex', gap: '15px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                                    <div style={{ flex: 2, minWidth: '200px' }}>
                                        <label style={{ display: 'block', fontSize: '13px', marginBottom: '5px' }}>Nome do Livro</label>
                                        <input type="text" value={novoLivro.nome} onChange={(e) => setNovoLivro({ ...novoLivro, nome: e.target.value })} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ced4da', boxSizing: 'border-box' }} required />
                                    </div>
                                    <div style={{ flex: 1, minWidth: '150px' }}>
                                        <label style={{ display: 'block', fontSize: '13px', marginBottom: '5px' }}>Autor</label>
                                        <select value={novoLivro.autorId} onChange={(e) => setNovoLivro({ ...novoLivro, autorId: e.target.value })} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ced4da', boxSizing: 'border-box' }} required>
                                            <option value="">Selecione...</option>
                                            {autores.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
                                        </select>
                                    </div>
                                    <div style={{ flex: 1, minWidth: '150px' }}>
                                        <label style={{ display: 'block', fontSize: '13px', marginBottom: '5px' }}>Gênero</label>
                                        <input type="text" value={novoLivro.genero} onChange={(e) => setNovoLivro({ ...novoLivro, genero: e.target.value })} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ced4da', boxSizing: 'border-box' }} required />
                                    </div>
                                    <button type="submit" style={{ padding: '9px 20px', backgroundColor: '#107c41', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', height: '36px' }}>Salvar no Banco</button>
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