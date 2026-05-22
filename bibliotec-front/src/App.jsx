import React, { useState, useEffect } from 'react';
import { useMsal } from '@azure/msal-react';
import { InteractionStatus } from '@azure/msal-browser';
import { loginRequest } from './authConfig';
import axios from 'axios';

const API_URL = "https://localhost:7172/api";

// Paleta de Cores Oficial Fiotec
const CORES = {
    azul: '#0082C6',
    cinzaEscuro: '#4E4E4E',
    cinzaMedio: '#A9ADB1',
    branco: '#FFFFFF',
    verde: '#70BF4A',
    vermelho: '#F04A42',
    amarelo: '#F1BD36',
    roxo: '#9E519F',
    fundo: '#F8F9FA'
};

function App() {
    const { instance, accounts, inProgress } = useMsal();

    // ESTADOS PRINCIPAIS
    const [livros, setLivros] = useState([]);
    const [autores, setAutores] = useState([]);
    const [emprestimos, setEmprestimos] = useState([]);
    const [carregando, setCarregando] = useState(false);
    const [perfilUsuario, setPerfilUsuario] = useState('');
    const [abaAtiva, setAbaAtiva] = useState('catalogo');

    // ESTADOS DO LOGIN LOCAL
    const [emailForm, setEmailForm] = useState('');
    const [senhaForm, setSenhaForm] = useState('');
    const [carregandoLoginComum, setCarregandoLoginComum] = useState(false);

    // ESTADOS DOS FILTROS
    const [busca, setBusca] = useState('');
    const [apenasDisponiveis, setApenasDisponiveis] = useState(false);
    const [autorSelecionado, setAutorSelecionado] = useState('');

    // ESTADO DE CADASTRO DE LIVRO (Atualizado com os novos campos da planilha)
    const [novoLivro, setNovoLivro] = useState({
        nome: '',
        autorId: '',
        genero: '',
        ano: '',
        codigo: '',
        resumo: '',
        quantidade: 1
    });

    // 1️⃣ LÓGICA: LOGIN TRADICIONAL
    const handleLoginTradicional = async (e) => {
        e.preventDefault();
        setCarregandoLoginComum(true);
        try {
            const response = await axios.post(`${API_URL}/autenticacao/login`, { email: emailForm, password: senhaForm });
            const { token, usuario } = response.data;

            localStorage.setItem("token_biblioteca", token);
            localStorage.setItem("perfil_biblioteca", usuario.permissao);
            localStorage.setItem("nome_usuario_comum", usuario.nome);
            setPerfilUsuario(usuario.permissao);

            carregarDadosIniciais();
        } catch (error) {
            alert(error.response?.data?.mensagem || "E-mail ou senha incorretos.");
        } finally { setCarregandoLoginComum(false); }
    };

    // 2️⃣ LÓGICA: LOGIN MICROSOFT
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
        carregarMeusEmprestimos();
    };

    // REQUISIÇÕES HTTP GET
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

    const carregarMeusEmprestimos = async () => {
        try {
            const tokenSistema = localStorage.getItem("token_biblioteca");
            const response = await axios.get(`${API_URL}/Emprestimo/meus-emprestimos`, {
                headers: { 'Authorization': `Bearer ${tokenSistema}` }
            });
            setEmprestimos(response.data);
        } catch (error) {
            console.error("Erro ao buscar empréstimos:", error);
        }
    };

    // HANDLERS DOS FILTROS
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

    // AÇÕES DE EMPRÉSTIMO E DEVOLUÇÃO
    const handleSolicitarEmprestimo = async (livroId, livroNome) => {
        if (!window.confirm(`Confirmar solicitação do exemplar: ${livroNome}?`)) return;
        try {
            const tokenSistema = localStorage.getItem("token_biblioteca");
            const payload = { livroId: livroId, dataEmprestimo: new Date().toISOString() };
            await axios.post(`${API_URL}/Emprestimo`, payload, { headers: { 'Authorization': `Bearer ${tokenSistema}` } });
            carregarDadosIniciais();
        } catch (error) {
            alert(error.response?.data?.message || "Falha ao solicitar empréstimo.");
        }
    };

    const handleDevolverLivro = async (emprestimoId) => {
        if (!window.confirm("Confirmar a devolução deste exemplar ao acervo?")) return;
        try {
            const tokenSistema = localStorage.getItem("token_biblioteca");
            await axios.post(`${API_URL}/Emprestimo/${emprestimoId}/devolver`, {}, { headers: { 'Authorization': `Bearer ${tokenSistema}` } });
            carregarDadosIniciais();
        } catch (error) {
            alert(error.response?.data?.mensagem || "Erro ao processar devolução.");
        }
    };

    // ACTIONS ADMIN
    const handleCadastrarLivro = async (e) => {
        e.preventDefault();
        try {
            const tokenSistema = localStorage.getItem("token_biblioteca");
            // Converte dados numéricos antes de mandar para a API
            const payload = {
                ...novoLivro,
                ano: parseInt(novoLivro.ano) || 0,
                codigo: parseInt(novoLivro.codigo) || 0,
                quantidade: parseInt(novoLivro.quantidade) || 1,
                disponivel: true
            };

            await axios.post(`${API_URL}/livro`, payload, { headers: { 'Authorization': `Bearer ${tokenSistema}` } });
            setNovoLivro({ nome: '', autorId: '', genero: '', ano: '', codigo: '', resumo: '', quantidade: 1 });
            carregarLivros(apenasDisponiveis, autorSelecionado);
            alert("Livro cadastrado com sucesso!");
        } catch (e) {
            alert("Erro ao cadastrar livro. Verifique os dados.");
        }
    };

    const handleDeletarLivro = async (id, nome) => {
        if (!window.confirm(`Atenção: Deseja excluir permanentemente o exemplar "${nome}" do banco de dados?`)) return;
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

    // FILTROS JAVASCRIPT
    const livrosFiltrados = livros.filter(l =>
        l && l.nome && typeof l.nome === 'string' ? l.nome.toLowerCase().includes(busca.toLowerCase()) : false
    );

    const emprestimosAtivos = emprestimos.filter(emp => emp.ativo !== false && emp.Ativo !== false);
    const historicoDevolvidos = emprestimos.filter(emp => emp.ativo === false || emp.Ativo === false);
    const estaAutenticado = accounts.length > 0 || localStorage.getItem("token_biblioteca") !== null;

    // ESTILOS COMUNS (CSS-in-JS Fiotec)
    const inputStyle = { width: '100%', padding: '10px 12px', borderRadius: '4px', border: `1px solid ${CORES.cinzaMedio}`, boxSizing: 'border-box', color: CORES.cinzaEscuro, fontFamily: '"Articulat CF", sans-serif' };
    const buttonStyle = { padding: '10px 20px', color: CORES.branco, border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: '600', fontFamily: '"Articulat CF", sans-serif', transition: 'background-color 0.2s' };
    const cardStyle = { backgroundColor: CORES.branco, padding: '24px', borderRadius: '6px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', border: `1px solid #eaeaea` };
    const thStyle = { padding: '14px', borderBottom: `2px solid ${CORES.azul}`, color: CORES.cinzaEscuro, fontWeight: '600', fontSize: '14px' };
    const tdStyle = { padding: '14px', borderBottom: `1px solid #eaeaea`, color: CORES.cinzaEscuro, fontSize: '14px' };

    return (
        <div style={{ padding: '30px', fontFamily: '"Articulat CF", "Segoe UI", sans-serif', backgroundColor: CORES.fundo, minHeight: '100vh', color: CORES.cinzaEscuro }}>

            {/* HEADER COORPORATIVO */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: CORES.branco, padding: '20px 30px', borderRadius: '6px', boxShadow: '0 2px 6px rgba(0,0,0,0.04)', marginBottom: '30px' }}>
                <h2 style={{ margin: 0, color: CORES.azul, fontWeight: '800', letterSpacing: '-0.5px' }}>BIBLIOTEC FIOTEC</h2>
                {estaAutenticado && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                        <span style={{ fontSize: '15px' }}>Olá, <strong style={{ color: CORES.azul }}>{obterNomeUsuario()}</strong> <span style={{ color: CORES.cinzaMedio, fontSize: '12px' }}>| {perfilUsuario}</span></span>
                        <button onClick={() => { instance.logoutRedirect(); localStorage.clear(); window.location.reload(); }} style={{ ...buttonStyle, backgroundColor: CORES.vermelho, padding: '6px 16px', fontSize: '13px' }}>Sair do Sistema</button>
                    </div>
                )}
            </div>

            {/* TELA DE LOGIN */}
            {!estaAutenticado && (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'stretch', gap: '40px', marginTop: '60px', maxWidth: '900px', margin: '0 auto' }}>
                    <div style={cardStyle}>
                        <h3 style={{ margin: '0 0 20px 0', color: CORES.cinzaEscuro, fontWeight: '700' }}>Acesso Local</h3>
                        <form onSubmit={handleLoginTradicional} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '13px', marginBottom: '6px', fontWeight: '600' }}>E-mail Institucional</label>
                                <input type="email" value={emailForm} onChange={(e) => setEmailForm(e.target.value)} placeholder="usuario@fiotec.com.br" style={inputStyle} required />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '13px', marginBottom: '6px', fontWeight: '600' }}>Senha</label>
                                <input type="password" value={senhaForm} onChange={(e) => setSenhaForm(e.target.value)} placeholder="••••••••" style={inputStyle} required />
                            </div>
                            <button type="submit" disabled={carregandoLoginComum} style={{ ...buttonStyle, backgroundColor: CORES.cinzaEscuro, marginTop: '8px' }}>
                                {carregandoLoginComum ? "Validando..." : "Entrar"}
                            </button>
                        </form>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                        <span style={{ color: CORES.cinzaMedio, fontSize: '12px', fontWeight: 'bold' }}>OU</span>
                    </div>

                    <div style={{ ...cardStyle, justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
                        <h3 style={{ margin: '0 0 10px 0', color: CORES.cinzaEscuro, fontWeight: '700' }}>Acesso Corporativo</h3>
                        <p style={{ color: CORES.cinzaMedio, fontSize: '14px', marginBottom: '30px' }}>Utilize suas credenciais do pacote Office 365.</p>
                        <button onClick={handleLoginMicrosoft} style={{ ...buttonStyle, backgroundColor: CORES.azul, width: '100%' }}>Conectar via Microsoft</button>
                    </div>
                </div>
            )}

            {/* DASHBOARD INTERNO */}
            {estaAutenticado && (
                <div>
                    {/* NAVEGAÇÃO DE ABAS */}
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', borderBottom: `1px solid ${CORES.cinzaMedio}40`, paddingBottom: '12px' }}>
                        {[
                            { id: 'catalogo', label: 'Acervo Geral' },
                            { id: 'meus-emprestimos', label: `Pendentes (${emprestimosAtivos.length})` },
                            { id: 'historico', label: `Histórico de Devoluções` }
                        ].map(aba => (
                            <button
                                key={aba.id}
                                onClick={() => setAbaAtiva(aba.id)}
                                style={{ ...buttonStyle, backgroundColor: abaAtiva === aba.id ? CORES.azul : 'transparent', color: abaAtiva === aba.id ? CORES.branco : CORES.cinzaEscuro }}
                            >
                                {aba.label}
                            </button>
                        ))}

                        {(perfilUsuario === 'Admin' || perfilUsuario === 'Colaborador') && (
                            <button
                                onClick={() => setAbaAtiva('admin')}
                                style={{ ...buttonStyle, backgroundColor: abaAtiva === 'admin' ? CORES.cinzaEscuro : 'transparent', color: abaAtiva === 'admin' ? CORES.branco : CORES.cinzaEscuro, marginLeft: 'auto' }}
                            >
                                Gestão Administrativa
                            </button>
                        )}
                    </div>

                    {/* ABA 1: CATÁLOGO */}
                    {abaAtiva === 'catalogo' && (
                        <div>
                            {/* FILTROS */}
                            <div style={{ ...cardStyle, flexDirection: 'row', gap: '20px', alignItems: 'center', padding: '16px 24px', marginBottom: '24px' }}>
                                <input type="text" placeholder="Buscar título..." value={busca} onChange={(e) => setBusca(e.target.value)} style={{ ...inputStyle, flex: 2 }} />
                                <select value={autorSelecionado} onChange={handleAutorChange} style={{ ...inputStyle, flex: 1 }}>
                                    <option value="">Todos os Autores</option>
                                    {autores.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
                                </select>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: '600' }}>
                                    <input type="checkbox" checked={apenasDisponiveis} onChange={handleCheckboxChange} style={{ accentColor: CORES.azul }} /> Apenas Disponíveis
                                </label>
                                <button onClick={handleLimparFiltros} style={{ ...buttonStyle, backgroundColor: CORES.cinzaMedio }}>Limpar</button>
                            </div>

                            {/* GRID DE LIVROS */}
                            {carregando ? <p style={{ color: CORES.cinzaMedio }}>Sincronizando base de dados...</p> : (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '24px' }}>
                                    {livrosFiltrados.map((livro) => (
                                        <div key={livro.id} style={{ ...cardStyle, position: 'relative', overflow: 'hidden' }}>

                                            {/* Borda superior colorida baseada no CDD do Livro */}
                                            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '6px', backgroundColor: livro.cor || CORES.azul }}></div>

                                            <div>
                                                <h4 style={{ margin: '8px 0 6px 0', fontSize: '18px', color: CORES.cinzaEscuro, fontWeight: '800', lineHeight: '1.2' }}>{livro.nome}</h4>
                                                <p style={{ margin: '0 0 12px 0', fontSize: '14px', color: CORES.cinzaEscuro }}>Autor: <span style={{ fontWeight: '600', color: CORES.azul }}>{livro.autorNome || livro.autor?.nome || 'Não informado'}</span></p>

                                                {/* BADGES (Ano, Gênero, CDD) */}
                                                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
                                                    <span style={{ padding: '4px 8px', borderRadius: '4px', backgroundColor: '#F8F9FA', border: '1px solid #EAEAEA', fontSize: '12px', fontWeight: '700', color: CORES.cinzaEscuro }}>
                                                        📅 {livro.ano || 'S/D'}
                                                    </span>
                                                    <span style={{ padding: '4px 8px', borderRadius: '4px', backgroundColor: '#F8F9FA', border: '1px solid #EAEAEA', fontSize: '12px', fontWeight: '700', color: CORES.cinzaEscuro }}>
                                                        📚 {livro.genero || 'Geral'}
                                                    </span>
                                                    <span style={{ padding: '4px 8px', borderRadius: '4px', backgroundColor: livro.cor || CORES.cinzaMedio, color: CORES.branco, fontSize: '12px', fontWeight: '800' }}>
                                                        CDD {livro.codigo || '000'}
                                                    </span>
                                                </div>

                                                {/* RESUMO TRUNCADO */}
                                                <p style={{ margin: '0 0 20px 0', fontSize: '13px', color: CORES.cinzaMedio, lineHeight: '1.5', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }} title={livro.resumo}>
                                                    {livro.resumo || "Resumo não cadastrado no sistema."}
                                                </p>
                                            </div>

                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: `1px solid #eaeaea`, paddingTop: '16px' }}>
                                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                    <span style={{ fontSize: '13px', color: livro.quantidade > 0 ? CORES.verde : CORES.vermelho, fontWeight: '800' }}>
                                                        {livro.quantidade > 0 ? 'DISPONÍVEL' : 'ESGOTADO'}
                                                    </span>
                                                    <span style={{ fontSize: '11px', color: CORES.cinzaMedio, fontWeight: '600', marginTop: '2px' }}>
                                                        Estoque: {livro.quantidade} un.
                                                    </span>
                                                </div>

                                                <div style={{ display: 'flex', gap: '10px' }}>
                                                    <button
                                                        onClick={() => handleSolicitarEmprestimo(livro.id, livro.nome)}
                                                        disabled={livro.quantidade <= 0}
                                                        style={{ ...buttonStyle, backgroundColor: livro.quantidade > 0 ? CORES.azul : CORES.cinzaMedio, padding: '8px 16px', fontSize: '13px', cursor: livro.quantidade > 0 ? 'pointer' : 'not-allowed' }}
                                                    >
                                                        Solicitar
                                                    </button>
                                                    {perfilUsuario === 'Admin' && (
                                                        <button onClick={() => handleDeletarLivro(livro.id, livro.nome)} style={{ backgroundColor: 'transparent', border: 'none', color: CORES.vermelho, cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}>Excluir</button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ABA 2: PENDENTES */}
                    {abaAtiva === 'meus-emprestimos' && (
                        <div style={cardStyle}>
                            <h3 style={{ margin: '0 0 20px 0', color: CORES.azul, fontWeight: '700' }}>Exemplares Pendentes de Devolução</h3>
                            {emprestimosAtivos.length === 0 ? (
                                <p style={{ color: CORES.cinzaMedio }}>Você não possui pendências no momento.</p>
                            ) : (
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr style={{ textAlign: 'left' }}>
                                            <th style={thStyle}>Título do Exemplar</th>
                                            <th style={thStyle}>Data de Retirada</th>
                                            <th style={thStyle}>Status</th>
                                            <th style={{ ...thStyle, textAlign: 'right' }}>Ação</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {emprestimosAtivos.map((emp) => (
                                            <tr key={emp.id}>
                                                <td style={{ ...tdStyle, fontWeight: '600', color: CORES.azul }}>
                                                    {emp.tituloLivro || "Exemplar"}
                                                    <span style={{ display: 'block', fontSize: '12px', color: CORES.cinzaMedio, fontWeight: '400', marginTop: '4px' }}>Gênero: {emp.generoLivro || 'Geral'}</span>
                                                </td>
                                                <td style={tdStyle}>{new Date(emp.dataEmprestimo).toLocaleDateString('pt-BR')}</td>
                                                <td style={tdStyle}><span style={{ color: CORES.amarelo, fontWeight: '700', fontSize: '12px' }}>PENDENTE</span></td>
                                                <td style={{ ...tdStyle, textAlign: 'right' }}>
                                                    <button onClick={() => handleDevolverLivro(emp.id)} style={{ ...buttonStyle, backgroundColor: CORES.verde, padding: '6px 14px', fontSize: '12px' }}>Devolver</button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    )}

                    {/* ABA 3: HISTÓRICO */}
                    {abaAtiva === 'historico' && (
                        <div style={cardStyle}>
                            <h3 style={{ margin: '0 0 20px 0', color: CORES.cinzaEscuro, fontWeight: '700' }}>Histórico de Empréstimos</h3>
                            {historicoDevolvidos.length === 0 ? (
                                <p style={{ color: CORES.cinzaMedio }}>Nenhum registro de devolução encontrado.</p>
                            ) : (
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr style={{ textAlign: 'left' }}>
                                            <th style={{ ...thStyle, borderColor: CORES.cinzaMedio }}>Título do Exemplar</th>
                                            <th style={{ ...thStyle, borderColor: CORES.cinzaMedio }}>Data de Retirada</th>
                                            <th style={{ ...thStyle, borderColor: CORES.cinzaMedio }}>Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {historicoDevolvidos.map((emp) => (
                                            <tr key={emp.id}>
                                                <td style={tdStyle}>
                                                    <strong style={{ color: CORES.cinzaEscuro }}>{emp.tituloLivro || "Exemplar"}</strong>
                                                    <span style={{ display: 'block', fontSize: '12px', color: CORES.cinzaMedio, marginTop: '4px' }}>Gênero: {emp.generoLivro || 'Geral'}</span>
                                                </td>
                                                <td style={tdStyle}>{new Date(emp.dataEmprestimo).toLocaleDateString('pt-BR')}</td>
                                                <td style={tdStyle}><span style={{ color: CORES.verde, fontWeight: '700', fontSize: '12px' }}>DEVOLVIDO</span></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    )}

                    {/* ABA 4: ADMIN (Formulário Atualizado) */}
                    {abaAtiva === 'admin' && (perfilUsuario === 'Admin' || perfilUsuario === 'Colaborador') && (
                        <div style={cardStyle}>
                            <h3 style={{ margin: '0 0 20px 0', color: CORES.cinzaEscuro, fontWeight: '700' }}>Cadastro de Novo Acervo</h3>
                            <form onSubmit={handleCadastrarLivro} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

                                <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                                    <div style={{ flex: 2, minWidth: '250px' }}>
                                        <label style={{ display: 'block', fontSize: '13px', marginBottom: '6px', fontWeight: '600' }}>Título da Obra</label>
                                        <input type="text" value={novoLivro.nome} onChange={(e) => setNovoLivro({ ...novoLivro, nome: e.target.value })} style={inputStyle} required />
                                    </div>
                                    <div style={{ flex: 1, minWidth: '200px' }}>
                                        <label style={{ display: 'block', fontSize: '13px', marginBottom: '6px', fontWeight: '600' }}>Autor</label>
                                        <select value={novoLivro.autorId} onChange={(e) => setNovoLivro({ ...novoLivro, autorId: e.target.value })} style={inputStyle} required>
                                            <option value="">Selecione na base...</option>
                                            {autores.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
                                        </select>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                                    <div style={{ flex: 1, minWidth: '150px' }}>
                                        <label style={{ display: 'block', fontSize: '13px', marginBottom: '6px', fontWeight: '600' }}>Gênero Principal</label>
                                        <input type="text" value={novoLivro.genero} onChange={(e) => setNovoLivro({ ...novoLivro, genero: e.target.value })} style={inputStyle} required />
                                    </div>
                                    <div style={{ flex: 1, minWidth: '100px' }}>
                                        <label style={{ display: 'block', fontSize: '13px', marginBottom: '6px', fontWeight: '600' }}>Ano</label>
                                        <input type="number" value={novoLivro.ano} onChange={(e) => setNovoLivro({ ...novoLivro, ano: e.target.value })} style={inputStyle} required />
                                    </div>
                                    <div style={{ flex: 1, minWidth: '100px' }}>
                                        <label style={{ display: 'block', fontSize: '13px', marginBottom: '6px', fontWeight: '600' }}>Cód. CDD</label>
                                        <input type="number" value={novoLivro.codigo} onChange={(e) => setNovoLivro({ ...novoLivro, codigo: e.target.value })} placeholder="Ex: 900" style={inputStyle} required />
                                    </div>
                                    <div style={{ flex: 1, minWidth: '100px' }}>
                                        <label style={{ display: 'block', fontSize: '13px', marginBottom: '6px', fontWeight: '600' }}>Quantidade</label>
                                        <input type="number" min="1" value={novoLivro.quantidade} onChange={(e) => setNovoLivro({ ...novoLivro, quantidade: e.target.value })} style={inputStyle} required />
                                    </div>
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '13px', marginBottom: '6px', fontWeight: '600' }}>Resumo Ficha Catalográfica</label>
                                    <textarea value={novoLivro.resumo} onChange={(e) => setNovoLivro({ ...novoLivro, resumo: e.target.value })} style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }} required></textarea>
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                    <button type="submit" style={{ ...buttonStyle, backgroundColor: CORES.verde, padding: '12px 24px' }}>💾 Salvar Registro no MySQL</button>
                                </div>
                            </form>
                        </div>
                    )}

                </div>
            )}
        </div>
    );
}

export default App;