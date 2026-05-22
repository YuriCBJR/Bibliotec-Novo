import { Autor, Livro, Emprestimo } from './types';

export const INITIAL_AUTORES: Autor[] = [
  { id: "a1", nome: "Machado de Assis" },
  { id: "a2", nome: "Clarice Lispector" },
  { id: "a3", nome: "George Orwell" },
  { id: "a4", nome: "J.R.R. Tolkien" },
  { id: "a5", nome: "Carolina Maria de Jesus" },
  { id: "a6", nome: "Gabriel García Márquez" }
];

export const INITIAL_LIVROS: Livro[] = [
  {
    id: "l1",
    nome: "Dom Casmurro",
    autorId: "a1",
    autorNome: "Machado de Assis",
    autor: { id: "a1", nome: "Machado de Assis" },
    genero: "Romance Realista",
    ano: 1899,
    codigo: 869, // Literatura Portuguesa / Brasileira
    resumo: "Um dos grandes clássicos da literatura brasileira que narra a história de Bento Santiago (o Bentinho) e sua dúvida torturante sobre a fidelidade de sua esposa Capitu, com quem havia sonhado viver desde a juventude.",
    quantidade: 3,
    cor: "#0082C6", // Fiotec Blue
    disponivel: true
  },
  {
    id: "l2",
    nome: "A Hora da Estrela",
    autorId: "a2",
    autorNome: "Clarice Lispector",
    autor: { id: "a2", nome: "Clarice Lispector" },
    genero: "Ficção Psicológica",
    ano: 1977,
    codigo: 869,
    resumo: "A tocante história de Macabéa, uma datilógrafa alagoana órfã de dezenove anos, recém-chegada ao Rio de Janeiro. Uma narrativa intimista escrita por Rodrigo S.M. que expõe a crueldade social e a falta de propósito da protagonista.",
    quantidade: 2,
    cor: "#9E519F", // Fiotec Violet
    disponivel: true
  },
  {
    id: "l3",
    nome: "1984",
    autorId: "a3",
    autorNome: "George Orwell",
    autor: { id: "a3", nome: "George Orwell" },
    genero: "Ficção Científica Distópica",
    ano: 1949,
    codigo: 823, // Literatura Inglesa
    resumo: "O mais influente romance futurista do século XX, focado na rotina opressiva de Winston Smith, um cidadão submetido ao controle totalitário do Grande Irmão e do Partido Inglês em uma sociedade sem privacidade.",
    quantidade: 5,
    cor: "#F04A42", // Fiotec Red
    disponivel: true
  },
  {
    id: "l4",
    nome: "Quarto de Despejo: Diário de uma Favelada",
    autorId: "a5",
    autorNome: "Carolina Maria de Jesus",
    autor: { id: "a5", nome: "Carolina Maria de Jesus" },
    genero: "Biografia / Diário",
    ano: 1960,
    codigo: 920, // Biografias
    resumo: "O relato real e visceral do cotidiano de Carolina, uma catadora de papel moradora da favela do Canindé em São Paulo, lutando bravamente dia após dia para alimentar seus filhos através de uma escrita poética e afiada.",
    quantidade: 4,
    cor: "#70BF4A", // Fiotec Green
    disponivel: true
  },
  {
    id: "l5",
    nome: "O Senhor dos Anéis: A Sociedade do Anel",
    autorId: "a4",
    autorNome: "J.R.R. Tolkien",
    autor: { id: "a4", nome: "J.R.R. Tolkien" },
    genero: "Alta Fantasia",
    ano: 1954,
    codigo: 823,
    resumo: "Na pacífica vila dos Hobbits, o jovem Frodo Bolseiro recebe o Um Anel de herança de seu tio Bilbo e tem a monumental tarefa de iniciar uma jornada mística para destruir a maior força de poder opressor da Terra Média.",
    quantidade: 0,
    cor: "#F1BD36", // Fiotec Yellow
    disponivel: false
  },
  {
    id: "l6",
    nome: "Cem Anos de Solidão",
    autorId: "a6",
    autorNome: "Gabriel García Márquez",
    autor: { id: "a6", nome: "Gabriel García Márquez" },
    genero: "Realismo Mágico",
    ano: 1967,
    codigo: 863, // Literatura Espanhola / Latino-Americana
    resumo: "A fantástica saga multigeracional da família Buendía na lendária aldeia de Macondo, onde o milagre e o absurdo coexistem nativamente sob o signo da solidão e das revoluções latinas.",
    quantidade: 1,
    cor: "#1f2937", // Slate Custom
    disponivel: true
  }
];

export const INITIAL_EMPRESTIMOS: Emprestimo[] = [
  {
    id: "e1",
    livroId: "l1",
    tituloLivro: "Dom Casmurro",
    generoLivro: "Romance Realista",
    dataEmprestimo: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 dias atrás
    dataDevolucao: null,
    ativo: true
  },
  {
    id: "e2",
    livroId: "l3",
    tituloLivro: "1984",
    generoLivro: "Ficção Científica Distópica",
    dataEmprestimo: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(), // 15 dias atrás
    dataDevolucao: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // Devolvido há 2 dias
    ativo: false
  }
];
